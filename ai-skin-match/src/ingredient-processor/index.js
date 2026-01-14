export default ({ action }, { services }) => {
    const { ItemsService } = services;

    const cleanIngredientName = (name) => {
        if (!name) return "";
        let text = String(name).replace(/\n/g, ' ').replace(/\u200b/g, '');
        return text.trim().split(/\s+/).join(' ').toLowerCase();
    };

    const processIngredients = async (productId, tempString, { schema, accountability }) => {
        if (!tempString) return;

        const ingredientService = new ItemsService('ingredient', { schema, accountability });
        const junctionService = new ItemsService('product_ingredient', { schema, accountability });

        const rawList = tempString.split(',');
        const cleanedNames = rawList
            .map(item => cleanIngredientName(item))
            .filter(item => item !== "");

        const uniqueNames = [...new Set(cleanedNames)];
        const ingredientLinks = [];

        for (const name of uniqueNames) {
            const existing = await ingredientService.readByQuery({
                filter: { name: { _eq: name } },
                limit: 1,
            });

            let ingredientId;

            if (existing.length > 0) {
                ingredientId = existing[0].id;
            } else {
                ingredientId = await ingredientService.createOne({ name: name });
            }

            ingredientLinks.push({
                product_id: productId,
                ingredient_id: ingredientId,
            });
        }

        await junctionService.deleteByQuery({
            filter: { product_id: { _eq: productId } },
        });

        if (ingredientLinks.length > 0) {
            await junctionService.createMany(ingredientLinks);
        }

    };

    action('product.items.create', async (input, context) => {
        const productId = input.key;
        const tempString = input.payload.temp_ingredients;
        if (tempString) await processIngredients(productId, tempString, context);
    });

    action('product.items.update', async (input, context) => {
        const tempString = input.payload.temp_ingredients;
        if (tempString && input.keys) {
            for (const id of input.keys) {
                await processIngredients(id, tempString, context);
            }
        }
    });
};