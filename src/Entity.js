import * as ImmutableUtils from './ImmutableUtils'
import { getRegisteredSchema } from './Resource'

const getDefaultGetId = (idAttribute) => (input) =>
  ImmutableUtils.isImmutable(input) ? input.get(idAttribute) : input[idAttribute]

export default class EntitySchema {
  constructor (key, definition = {}, options = {}) {
    if (!key || typeof key !== 'string') {
      throw new Error(`Expected a string key for Entity, but found ${ key }.`)
    }

    const {
      idAttribute = 'id',
      module_name,
      resource_name,
      mergeStrategy = (entityA, entityB) => {
        return { ...entityA, ...entityB }
      },
      processStrategy = (input) => ({ ...input })
    } = options

    this._key = key
    this._resourceName = resource_name
    this._moduleName = module_name
    this._getId = typeof idAttribute === 'function' ? idAttribute : getDefaultGetId(idAttribute)
    this._idAttribute = idAttribute
    this._mergeStrategy = mergeStrategy
    this._processStrategy = processStrategy
    this.define(definition)
  }

  get key () {
    return this._key
  }

  get idAttribute () {
    return this._idAttribute
  }

  get resource_name () {
    return this._resourceName
  }

  get module_name () {
    return this._moduleName
  }

  define (definition) {
    this.schema = Object.keys(definition).reduce((entitySchema, key) => {
      const schema = definition[key]
      return { ...entitySchema, [key]: schema }
    }, this.schema || {})
  }

  getId (input, parent, key) {
    return this._getId(input, parent, key)
  }

  merge (entityA, entityB) {
    return this._mergeStrategy(entityA, entityB)
  }

  normalize (input, parent, key, visit, addEntity) {
    const processedEntity = this._processStrategy(input, parent, key)

    Object.keys(processedEntity).
      concat(Object.keys(this.schema)).
      filter((elem, pos, arr) => {return arr.indexOf(elem) === pos}).
      forEach(key => {
        if (processedEntity.hasOwnProperty(key)
          && typeof processedEntity[key] === 'object' &&
          processedEntity[key] !== null) {

          const value = processedEntity[key]
          let schema = this.schema[key]

          if (Array.isArray(value) && value.length
            && typeof value[0] === 'object'
            && value[0].resource_name) {
            schema = getRegisteredSchema(value[0].module_name, value[0].resource_name)
          } else if (value.resource_name) {
            if(!value.id && key == 'embed_object'){
              value.id =  processedEntity.resource_name + '-' + processedEntity.id.toString() + '-'  + key
            }
            schema = getRegisteredSchema(value.module_name, value.resource_name)
          }

          if (schema) {
            const result = visit(value, processedEntity, key, schema, addEntity)
            const module_name = value.module_name || schema.module_name
            const resource_name = value.resource_name || schema.resource_name

            if(result){
              processedEntity[key] = { module_name, resource_name, id: result }
              if(!processedEntity._spec){
                processedEntity._spec = []
              }
              processedEntity._spec.push(key)
            }
          }
        }
      })

    addEntity(this, processedEntity, input, parent, key)
    return this.getId(input, parent, key)
  }

  denormalize (entity, unvisit) {
    if (ImmutableUtils.isImmutable(entity)) {
      return ImmutableUtils.denormalizeImmutable(this.schema, entity, unvisit)
    }

    Object.keys(this.schema).forEach((key) => {
      if (entity.hasOwnProperty(key)) {
        const schema = this.schema[key]
        entity[key] = unvisit(entity[key], schema)
      }
    })
    return entity
  }
}
