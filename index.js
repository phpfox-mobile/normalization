import EntitySchema from './src/Entity'
import UnionSchema from './src/Union'
import ValuesSchema from './src/Values'
import ArraySchema from './src/Array'
import ObjectSchema from './src/Object'
import type { EntityDataProps } from './src/Types'

export { simpleTagSchema, simpleUserSchema, attachmentSchema } from './src/Simple'

export { normalize, denormalize, normalizeData } from './src/Schema'
export { nextTrackerId } from './src/Tracker'
export {
  getRegisteredSchema, getModuleNameByResourceName, getResourceAlias, getRegisteredResourceName,
  getSchemaDefinition, registerResourceAlias, getRegisteredSchemaKeys, registerSchemaDefinition,
  registerSchema
} from './src/Resource'

export {
  createSchema,
  checkDefinition, createCustomSchemas
} from './src/Storage'

export const schema = {
  Array: ArraySchema,
  Entity: EntitySchema,
  Object: ObjectSchema,
  Union: UnionSchema,
  Values: ValuesSchema
}
