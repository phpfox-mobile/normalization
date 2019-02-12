import * as ImmutableUtils from './src/ImmutableUtils'
import EntitySchema from './src/Entity'
import UnionSchema from './src/Union'
import ValuesSchema from './src/Values'
import ArraySchema, * as ArrayUtils from './src/Array'
import ObjectSchema, * as ObjectUtils from './src/Object'
import type { EntityDataProps, NormalizedData, ReferenceProps, SchemaConfig } from './src/Types'
import idx from 'idx'
import { nextTrackerId } from './src/Tracker'
import { attachmentSchema, simpleTagSchema, simpleUserSchema } from './src/Simple'

const visit = (value, parent, key, schema, addEntity) => {
  if (typeof value !== 'object' || !value) {
    return value
  }

  if (Array.isArray(value) && typeof schema === 'object') {
    if (!value.length || !value[0]) {
      return undefined
    }

    const { module_name, resource_name } = value[0]

    return ArrayUtils.normalize(schema, value, parent, key, visit, addEntity)
  }

  if (typeof schema === 'object' && (!schema.normalize || typeof schema.normalize !== 'function')) {
    const method = Array.isArray(value) ? ArrayUtils.normalize : ObjectUtils.normalize
    return method(schema, value, parent, key, visit, addEntity)
  }

  return schema.normalize(value, parent, key, visit, addEntity)
}

const addEntities = (entities) => (schema, processedEntity, value, parent, key) => {
  const resource_name = processedEntity.resource_name || schema.resource_name
  const module_name = processedEntity.module_name || schema.module_name
  const id = schema.getId(value, parent, key)

  if (!entities[module_name]) {
    entities[module_name] = {}
  }
  if (!entities[module_name][resource_name]) {
    entities[module_name][resource_name] = {}
  }

  const existingEntity = entities[module_name][resource_name][id]
  if (existingEntity) {
    entities[module_name][resource_name][id] = schema.merge(existingEntity, processedEntity)
  } else {
    entities[module_name][resource_name][id] = processedEntity
  }
}

export const schema = {
  Array: ArraySchema,
  Entity: EntitySchema,
  Object: ObjectSchema,
  Union: UnionSchema,
  Values: ValuesSchema
}

export function normalizeData (data, schema): NormalizedData {
  const temp = Array.isArray(data)
    ? normalize(data, schema)
    : normalize(data, schema)

  return { entities: temp.entities, ids: temp.result }
}

export const normalize = (input, schema) => {
  if (!input || typeof input !== 'object') {
    throw new Error(
      `Unexpected input given to normalize. Expected type to be "object", found "${ typeof input }".`)
  }

  const entities = {}
  const addEntity = addEntities(entities)

  const result = visit(input, input, null, schema, addEntity)
  return { entities, result }
}

const unvisitEntity = (id, schema, unvisit, getEntity, cache) => {
  const entity = getEntity(id, schema)
  if (typeof entity !== 'object' || entity === null) {
    return entity
  }

  if (!cache[schema.key]) {
    cache[schema.key] = {}
  }

  if (!cache[schema.key][id]) {
    // Ensure we don't mutate it non-immutable objects
    const entityCopy = ImmutableUtils.isImmutable(entity) ? entity : { ...entity }

    // Need to set this first so that if it is referenced further within the
    // denormalization the reference will already exist.
    cache[schema.key][id] = entityCopy
    cache[schema.key][id] = schema.denormalize(entityCopy, unvisit)
  }

  return cache[schema.key][id]
}

const getUnvisit = (entities) => {
  const cache = {}
  const getEntity = getEntities(entities)

  return function unvisit (input, schema) {
    if (typeof schema === 'object' &&
      (!schema.denormalize || typeof schema.denormalize !== 'function')) {
      const method = Array.isArray(schema) ? ArrayUtils.denormalize : ObjectUtils.denormalize
      return method(schema, input, unvisit)
    }

    if (input === undefined || input === null) {
      return input
    }

    if (schema instanceof EntitySchema) {
      return unvisitEntity(input, schema, unvisit, getEntity, cache)
    }

    return schema.denormalize(input, unvisit)
  }
}

const getEntities = (entities) => {
  const isImmutable = ImmutableUtils.isImmutable(entities)

  return (entityOrId, schema) => {
    const schemaKey = schema.key

    if (typeof entityOrId === 'object') {
      return entityOrId
    }

    return isImmutable
      ? entities.getIn([schemaKey, entityOrId.toString()])
      : entities[schemaKey][entityOrId]
  }
}

export const denormalize = (input, schema, entities) => {
  if (typeof input !== 'undefined') {
    return getUnvisit(entities)(input, schema)
  }
}

const SchemaStorage = {}
const SchemaDefinition = {}
const ResourceMap = {}
const ResourceAlias = {}

export function registerResourceAlias (module_name, resource_name, alias) {
  if (!ResourceAlias[module_name]) {
    ResourceAlias[module_name] = {}
  }
  ResourceAlias[module_name][alias] = resource_name
}

export function getRegisteredResourceName (module_name, resource_name) {
  resource_name = resource_name.replace('-', '_')

  let name = idx(ResourceAlias, v => v[module_name][resource_name])
  if (name) {
    return name
  }
  if (idx(SchemaStorage, v => v[module_name][resource_name])) {
    return resource_name
  }

  return null
}

export function getResourceAlias (module_name, alias) {
  return idx(ResourceAlias, v => v[module_name][alias])
}

export const registerSchemaDefinition = (
  module_name, resource_name, key, ref: ReferenceProps) => {
  if (!SchemaDefinition[module_name]) {
    SchemaDefinition[module_name] = {}
  }
  if (!SchemaDefinition[module_name][resource_name]) {
    SchemaDefinition[module_name][resource_name] = {}
  }
  SchemaDefinition[module_name][resource_name][key] = ref
}

export const getModuleNameByResourceName = (resource_name) => {
  return ResourceMap[resource_name] ? ResourceMap[resource_name] : null
}

export const getSchemaDefinition = (module_name, resource_name, key) => {

  return key
    ? idx(SchemaDefinition, v => v[module_name][resource_name][key])
    : idx(SchemaDefinition, v => v[module_name][resource_name])
}

export const registerSchema = (module_name, resource_name, entity) => {

  ResourceMap[resource_name] = module_name

  if (!SchemaStorage[module_name]) {
    SchemaStorage[module_name] = {}
  }

  if (!SchemaStorage[module_name][resource_name]) {
    SchemaStorage[module_name][resource_name] = {}
  }

  SchemaStorage[module_name][resource_name] = entity
}

export const getRegisteredSchema = (module_name, resource_name): ?EntitySchema => {
  if (resource_name === '_user') {
    return simpleUserSchema
  }

  if (resource_name === '_user[]') {
    return simpleUserSchema
  }

  return idx(SchemaStorage, v => v[module_name][resource_name])
}

export const getRegisteredSchemaKeys = () => {
  const result = []
  Object.keys(SchemaStorage).forEach(module => {
    Object.keys(SchemaStorage[module]).forEach(resource => {
      result.push(`${ module }.${ resource }`)
    })
  })
  return result
}

export const checkDefinition = (config: SchemaConfig) => {

  config.is_valid = true
  config.is_custom_schema = true
  config.relations = {}

  if (!config.definition) {
    return config
  }

  const result = {}

  Object.keys(config.definition).forEach((key) => {
    let string = config.definition[key]
    const is_array = string.endsWith('[]')
    string = string.replace('[]', '')
    let module_name = config.module_name
    let resource_name = config.resource_name

    if (string.indexOf('.') > 0) {
      const array = string.split('.')
      module_name = array[0]
      resource_name = array[1]
    } else {
      resource_name = string
    }

    if (module_name === config.module_name && resource_name ===
      config.resource_name) {
      // process self definition.
      config.relations[key] = {
        self_define: true,
        module_name,
        resource_name,
        is_array
      }
    } else {
      // check dependencies
      let schema = getRegisteredSchema(module_name, resource_name)
      if (schema) {
        config.relations[key] = {
          module_name,
          resource_name,
          is_array
        }
        result[key] = is_array ? [schema] : schema
      } else {
        config.is_valid = false
      }
    }
  })

  if (config.is_valid) {
    // assign only correction
    config.definition = result
    // console.log(`valid schema ${config.module_name}.${config.resource_name} definition`, Object.keys(result))
  } else {
    // console.log(`IN-valid schema ${config.module_name}.${config.resource_name} definition`, Object.keys(result))
  }

  return config
}

export const createCustomSchemas = (customSchemas) => {
  // console.log(customSchemas.map(x => `${x.module_name}.${x.resource_name}`))
  [1, 2, 3, 4, 5].forEach(() => {
    customSchemas.map(x => checkDefinition(x)).
      filter(x => x.is_valid).
      map(x => createSchema(x))
    customSchemas = customSchemas.filter(x => !x.is_valid)
  })
}

export const createSchema = (config: SchemaConfig): schema.Entity => {
  const entity = new EntitySchema(config.resource_name, {
    user: simpleUserSchema,
    owner: simpleUserSchema,
    attachments: attachmentSchema,
    tags: simpleTagSchema,
    parent_user: simpleUserSchema,
    tagged_friends: simpleUserSchema,
    user_tags: simpleUserSchema,
    ...config.definition
  }, {
    idAttribute: config.idAttribute,
    resourceName: config.resource_name,
    moduleName: config.module_name,
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
