import * as ArrayUtils from './Array'
import * as ObjectUtils from './Object'
import type { NormalizedData } from './Types'
import * as ImmutableUtils from './ImmutableUtils'
import EntitySchema from './Entity'

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
