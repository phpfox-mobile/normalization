
export type NormalizedData  = {
  entities: Object,
  ids: Array,
}

export type ReferenceProps = {
  module_name: String,
  resource_name: String,
  is_array?: boolean
}



export type SchemaConfig = {
  ref?: string,
  idAttribute: any,
  module_name: string,
  resource_name: string,
  definition: string,
  relations: Object,
  extras: Object,
  is_valid: boolean,
  is_custom_schema: boolean,
}
