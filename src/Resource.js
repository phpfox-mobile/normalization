import idx from 'idx'
import type { ReferenceProps, SchemaConfig } from './Types'
import { simpleUserSchema } from './Simple'

const SchemaDefinition = {}
const ResourceMap = {}
const ResourceAlias = {}
const SchemaStorage = {}

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

export const getRegisteredSchema = (module_name, resource_name) => {
  if (resource_name === '_user') {
    return simpleUserSchema
  }

  if (resource_name === '_user[]') {
    return simpleUserSchema
  }

  if (!module_name) {
    module_name = getModuleNameByResourceName(resource_name)
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
