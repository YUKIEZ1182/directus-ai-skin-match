import axios from 'axios';

export default ({ schedule }, { services, env, logger, getSchema }) => {
    const { ItemsService } = services;

    const RETRAIN_SCHEDULE = env.AI_RETRAIN_SCHEDULE || '0 0 * * 1';

    schedule(RETRAIN_SCHEDULE, async () => {
        logger.info(`Retraining cron job is starting`);

        try {
            const schema = await getSchema();
            const productService = new ItemsService('product', { schema });

            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const updatedProducts = await productService.readByQuery({
                filter: {
                    _or: [
                        { date_created: { _gte: sevenDaysAgo.toISOString() } },
                        { date_updated: { _gte: sevenDaysAgo.toISOString() } }
                    ]
                },
                fields: ['id', 'name', 'ingredients.ingredient_id.name', 'suitable_skin_type'],
                limit: -1
            });

            if (updatedProducts.length === 0) {
                logger.info('new product not found, skip retrain');
                return;
            }

            const payload = updatedProducts.map(p => ({
                id: p.id,
                name: p.name,
                ingredients: (p.ingredients || [])
                    .map(item => item.ingredient_id?.name)
                    .filter(name => name)
                    .join(', '),
                skin_types: p.suitable_skin_type
            }));

            const PYTHON_API_URL = env.PYTHON_API_URL;
            
            const response = await axios.post(`${PYTHON_API_URL}/retrain`, payload);
            
            logger.info(` Retrain success (Updated: ${response.data.updated}, Added: ${response.data.new_added})`);

        } catch (error) {
            logger.error(`AI Skin Match Error: ${error.message}`);
        }
    });
};