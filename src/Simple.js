import EntitySchema from './Entity'

export const simpleUserSchema = new EntitySchema('_user', {}, {
  moduleName: 'user',
  resourceName: 'user'
})

export const simpleTagSchema = new EntitySchema('tag', {}, {
  moduleName: 'core',
  resourceName: 'tag'
})

export const attachmentSchema = new EntitySchema('attachment', {}, {
  moduleName: 'core ',
  resourceName: 'attachment'
})
