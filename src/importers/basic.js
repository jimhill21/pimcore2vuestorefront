module.exports = class {
    constructor(entityType, customImporter, config, api, db) {
        this.config = config
        this.db = db
        this.api = api
        this.entityType = entityType
        this.customImporter = customImporter
        this.single = this.single.bind(this)
    }

    
    /**
     * @returns Promise
     */
    single(descriptor) {
        return new Promise(((resolve, reject) => {
            this.api.get(`object/id/${descriptor.id}`).end((resp) => {
                console.log('Processing object: ', descriptor.id)
                const objectData = resp.body.data
                const subpromises = []

                if (objectData.childs) {
                    for (let chdDescriptor of objectData.childs) {
                        console.log('- child objects found: ', chdDescriptor.id)
                        subpromises.push(this.single(chdDescriptor))
                    }
                }

                let result = this.resultTemplate(this.entityType) // TOOD: objectData.childs should be also taken into consideration
                const locale = this.config.pimcore.locale
                const entityConfig = this.config.pimcore[`${this.entityType}Class`]
                let localizedFields = objectData.elements.find((itm)=> { return itm.name === 'localizedfields'}).value

                result.created_at = new Date(objectData.creationDate*1000)
                result.updated_at = new Date(objectData.modificationDate*1000)
                result.id = descriptor.id
                result.sku = descriptor.id

                Object.keys(entityConfig.map).map((srcField) => {
                    const dstField = entityConfig.map[srcField]
                    const dstValue = localizedFields.find((lf) => { return lf.name === dstField && lf.language === locale})

                    if(!dstValue)
                    {
                        console.error('Cannot find the value for ', dstField, locale)
                    }
                    result[srcField] = dstValue.type === 'numeric' ? parseFloat(dstValue.value) : dstValue.value
                })
                
                Promise.all(subpromises).then((childrenResults) => {
                    if(this.customImporter)
                    {
                        this.customImporter.single(objectData, result, childrenResults).then((resp) => {
                            if (childrenResults.length > 0)
                            {
                                childrenResults.push(resp)
                                resolve(childrenResults)
                            } else resolve(resp)
                        })
                    } else {
                        if (childrenResults.length > 0)
                        {                        
                            childrenResults.push({ dst: result, src: objectData })
                            resolve(childrenResults)
                        } else {
                            resolve({ dst: result, src: objectData })
                        }
                        
                    }
                })
            })
        }))
    }

    resultTemplate (entityType) {
        return Object.assign({}, require(`./templates/${entityType}.json`))
    }
}