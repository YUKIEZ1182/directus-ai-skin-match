import axios from 'axios';

export default ({ schedule }, { services, env, logger, getSchema }) => {
    const { ItemsService } = services;

    schedule('0 0 * * 1', async () => {
        logger.info('AI Skin Match: เริ่มต้นดึงข้อมูลสินค้าประจำสัปดาห์เพื่อ Retrain...');

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
                logger.info('AI Skin Match: ไม่มีสินค้าอัปเดตใหม่ใน 7 วันที่ผ่านมา ข้ามการ Retrain');
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

            // 4. ส่งไปที่ Python API
            const PYTHON_API_URL = env.PYTHON_API_URL;
            const response = await axios.post(`${PYTHON_API_URL}/retrain`, payload);
            
            logger.info(`AI Skin Match: Retrain สำเร็จ! ข้อมูลอัปเดต: ${response.data.updated}, เพิ่มใหม่: ${response.data.new_added}`);

        } catch (error) {
            logger.error(`AI Skin Match Error: ${error.message}`);
        }
    });
};