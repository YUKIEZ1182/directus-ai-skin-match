export default ({ filter }, { services }) => {
  const { ItemsService } = services;

  filter('product.items.update', async (payload, meta, { database, schema, accountability }) => {
    const isChangingStatusToActive = payload.status === 'active';
    const isUpdatingQuantity = payload.hasOwnProperty('quantity');

    if (isChangingStatusToActive || isUpdatingQuantity) {
      const productService = new ItemsService('product', {
        schema,
        accountability,
        knex: database,
      });

      for (const id of meta.keys) {
        const currentProduct = await productService.readOne(id, {
          fields: ['quantity', 'status'],
        });

        const finalQuantity = isUpdatingQuantity ? payload.quantity : currentProduct.quantity;

        if (finalQuantity === 0) {
          payload.status = 'inactive';
        }
      }
    }

    return payload;
  });

  filter('product.items.create', async (payload) => {
    if (payload.hasOwnProperty('quantity') && payload.quantity === 0) {
      payload.status = 'inactive';
    }
    return payload;
  });
};