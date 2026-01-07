export default ({ schedule }, { services, env }) => {
    const { ItemsService } = services;
    const orderRetentionCron = env.ORDER_RETENTION_CRON || "0 7 * * *";

    schedule(orderRetentionCron, async ({ schema }) => {
        const orderService = new ItemsService("order", { 
            schema: schema,
            accountability: { admin: true }
        });

        const todayStr = new Date().toISOString().split('T')[0];

        console.log(`[Order Retention] Running at 7AM. Target: Orders before ${todayStr}`);

        try {
            const abandonedOrders = await orderService.readByQuery({
                filter: {
                    _and: [
                        { status: { _eq: "pending" } },
                        { order_date: { _lt: todayStr } }
                    ]
                },
                fields: ["id", "order_no"],
                limit: -1
            });

            if (abandonedOrders.length > 0) {
                const orderIds = abandonedOrders.map(o => o.id);
                await orderService.deleteMany(orderIds);
                console.log(`[Order Retention] Deleted ${abandonedOrders.length} orders.`);
            } else {
                console.log("[Order Retention] No old pending orders found.");
            }
        } catch (error) {
            console.error("[Order Retention] Error:", error);
        }
    });
};