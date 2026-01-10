import axios from 'axios';

export default ({ schedule }, { env, logger }) => {
    const RETRAIN_SCHEDULE = env.AI_RETRAIN_SCHEDULE || '0 0 * * 1';

    schedule(RETRAIN_SCHEDULE, async () => {
        logger.info(`Retraining cron job is starting`);

        try {
            const PYTHON_API_URL = env.PYTHON_API_URL;
            if (!PYTHON_API_URL) {
                logger.error("PYTHON_API_URL is not defined in environment variables");
                return;
            }

            const response = await axios.post(`${PYTHON_API_URL}/retrain`);
            
            logger.info(`Retrain trigger status: ${response.data.status}`);

        } catch (error) {
            logger.error(`AI Skin Match Trigger Error: ${error.message}`);
        }
    });
};