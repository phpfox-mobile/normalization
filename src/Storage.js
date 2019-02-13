import idx from 'idx'
import EntitySchema from './Entity'
import type { EntityDataProps, SchemaConfig } from './Types'
import { attachmentSchema, simpleTagSchema, simpleUserSchema } from './Simple'
import { nextTrackerId } from './Tracker'
import {
  checkDefinition, getRegisteredSchema, registerResourceAlias, registerSchema,
  registerSchemaDefinition
} from './Resource'

export const createCustomSchemas = (customSchemas) => {
  // console.log(customSchemas.map(x => `${x.module_name}.${x.resource_name}`))
  [1, 2, 3, 4, 5].forEach(() => {
    customSchemas.map(x => checkDefinition(x)).
      filter(x => x.is_valid).
      map(x => createSchema(x))
    customSchemas = customSchemas.filter(x => !x.is_valid)
  })
}

export const createSchema = (config: SchemaConfig): EntitySchema => {
  const entity = new EntitySchema(config.resource_name, {
    attachments: attachmentSchema,
    tags: simpleTagSchema,
    tagged_friends: simpleUserSchema,
    user_tags: simpleUserSchema,
    ...config.definition
  }, {
    idAttribute: config.idAttribute,
    resource_name: config.resource_name,
    module_name: config.module_name,
    processStrategy: (entity: EntityDataProps) => {
      entity = {
        has_action: Object.values({
          ...entity.extra,
          can_like: false,
          can_comment: false,
          can_share: false
        }).filter(x => x === true).length > 0,
        ...entity,
        ...entity.statistic,
        ...entity.feed_param,
        ...entity.extra,
        ...config.extras,
        module_name: config.module_name,
        tracker: entity.tracker ? entity.tracker : nextTrackerId(entity)
      }
      delete entity.statistic
      delete entity.feed_param
      delete entity.extra
      return entity
    }
  })
  if (config.ref) {
    registerResourceAlias(config.module_name, config.resource_name, config.ref)
  }
  if (!getRegisteredSchema(config.module_name, config.resource_name)) {
    if (!config.relations) {
      config.relations = {
        tags: {
          module_name: config.module_name,
          resource_name: 'tags'
        },
        category: {
          module_name: config.module_name,
          resource_name: 'category'
        },
        categories: {
          module_name: config.module_name,
          resource_name: 'category',
          is_array: true
        }
      }
    }

    if (config.relations) {
      Object.keys(config.relations).forEach(key => {
        const def = idx(config.relations, x => x[key])
        if (def) {
          const module_name = def.module_name
            ? def.module_name
            : config.module_name
          const resource_name = def.resource_name
            ? def.resource_name
            : config.resource_name
          const is_array = def.is_array

          if (def.self_define) {
            entity.define({ [key]: entity })
          }
          registerSchemaDefinition(config.module_name, config.resource_name,
            key, {
              module_name: module_name,
              resource_name: resource_name,
              is_array
            })
        }
      })
    }
    if (config.is_custom_schema) {
      // console.log(`add custom schema ${config.module_name}.${config.resource_name}`)
    }

    if (config.ref) {
      registerSchema(config.module_name, config.ref, entity)
    }
    registerSchema(config.module_name, config.resource_name, entity)
  }

  return entity
}
