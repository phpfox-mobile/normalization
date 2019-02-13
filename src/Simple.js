import EntitySchema from './Entity'

export const simpleUserSchema = new EntitySchema('_user', {}, {
  module_name: 'user',
  resource_name: 'user'
})

export const simpleTagSchema = new EntitySchema('tag', {}, {
  module_name: 'core',
  resource_name: 'tag'
})

export const attachmentSchema = new EntitySchema('attachment', {}, {
  module_name: 'core ',
  resource_name: 'attachment'
})

export const embedObjectSchema = new EntitySchema('embed_object', {}, {
  module_name: false,
  resource_name: false
})
