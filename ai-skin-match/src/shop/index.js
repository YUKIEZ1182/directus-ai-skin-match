export default (router, { services, database }) => {
  const { ItemsService } = services;

  function getYYYYMMDD(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function getDateForRunning(date) {
    const year = date.getFullYear().toString().substring(2);
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    return `${year}${month}${day}`;
  }

  async function generateSequence(knex, sequenceName) {
    await knex.raw(`CREATE SEQUENCE IF NOT EXISTS ${sequenceName}`);
    const result = await knex.raw(`SELECT nextval('${sequenceName}')`);
    return result.rows[0]?.nextval;
  }

  async function generateOrderNo(knex) {
    const dateStr = getDateForRunning(new Date());
    const seqName = `order_no_seq_${dateStr}`;
    const seq = await generateSequence(knex, seqName);
    const running = seq.toString().padStart(4, "0");
    return `AI-SK-${dateStr}${running}`;
  }

  router.post("/checkout", async (req, res) => {
    if (!req.accountability || !req.accountability.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userId = req.accountability.user;
    const { 
      item_ids, 
      user_address, 
      payment_method,
    } = req.body;
    const todayStr = getYYYYMMDD(new Date());

    try {
      await database.transaction(async (trx) => {
        const cartService = new ItemsService("cart_detail", {
          schema: req.schema,
          accountability: req.accountability,
          knex: trx,
        });
        const orderService = new ItemsService("order", {
          schema: req.schema,
          accountability: req.accountability,
          knex: trx,
        });
        const orderDetailService = new ItemsService("order_detail", {
          schema: req.schema,
          accountability: req.accountability,
          knex: trx,
        });

        const cartItems = await cartService.readByQuery({
          filter: {
            _and: [{ owner: { _eq: userId } }, { id: { _in: item_ids } }],
          },
          fields: ["id", "quantity", "product.id", "product.price"],
        });

        if (!cartItems || cartItems.length === 0)
          throw new Error("Cart is empty");

        let totalPrice = 0;
        const orderDetailsPayload = [];
        for (const item of cartItems) {
          if (!item.product) continue;
          totalPrice += item.product.price * item.quantity;
          orderDetailsPayload.push({
            product_id: item.product.id,
            quantity: item.quantity,
            price_at_purchase: item.product.price,
          });
        }

        const existingOrders = await orderService.readByQuery({
          filter: {
            _and: [
              { owner: { _eq: userId } },
              { status: { _eq: "pending" } },
              { order_date: { _eq: todayStr } },
            ],
          },
          fields: ["id", "order_no"],
          limit: 1,
        });

        let targetOrderId;
        let targetOrderNo;

        if (existingOrders.length > 0) {
          const existing = existingOrders[0];
          targetOrderId = typeof existing === "object" ? existing.id : existing;

          if (typeof existing === "object") {
            targetOrderNo = existing.order_no;
          } else {
            const fetchedOrder = await orderService.readOne(targetOrderId, {
              fields: ["order_no"],
            });
            targetOrderNo = fetchedOrder.order_no;
          }

          await orderService.updateOne(targetOrderId, {
            total_price: totalPrice,
            user_address: user_address,
            payment_method: payment_method
          });
          await orderDetailService.deleteByQuery({
            filter: { order_id: { _eq: targetOrderId } },
          });
        } else {
          targetOrderNo = await generateOrderNo(trx);
          const result = await orderService.createOne({
            owner: userId,
            order_no: targetOrderNo,
            order_date: todayStr,
            total_price: totalPrice,
            status: "pending",
            user_address: user_address,
            payment_method: payment_method
          });
          targetOrderId = typeof result === "object" ? result.id : result;
        }

        if (!targetOrderId) throw new Error("Failed to retrieve Order ID");

        const detailsWithOrderId = orderDetailsPayload.map((detail) => ({
          ...detail,
          order_id: targetOrderId,
        }));

        await orderDetailService.createMany(detailsWithOrderId);

        res.json({
          success: true,
          order_id: targetOrderId,
          order_no: targetOrderNo,
          total_price: totalPrice,
        });
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post("/payment-webhook", async (req, res) => {
    const { order_id, payment_status } = req.body;
    if (!order_id || payment_status !== "success")
      return res.status(400).json({ error: "Invalid payment" });

    try {
      const schema = req.schema;
      const adminAcc = { admin: true };

      await database.transaction(async (trx) => {
        const orderService = new ItemsService("order", {
          schema,
          accountability: adminAcc,
          knex: trx,
        });
        const orderDetailService = new ItemsService("order_detail", {
          schema,
          accountability: adminAcc,
          knex: trx,
        });
        const productService = new ItemsService("product", {
          schema,
          accountability: adminAcc,
          knex: trx,
        });
        const cartService = new ItemsService("cart_detail", {
          schema,
          accountability: adminAcc,
          knex: trx,
        });

        const order = await orderService.readOne(order_id, {
          fields: ["id", "status", "owner"],
        });
        if (!order || order.status === "paid")
          return res.json({ message: "Already paid or not found" });

        const orderDetails = await orderDetailService.readByQuery({
          filter: { order_id: { _eq: order_id } },
          fields: ["product_id", "quantity"],
          limit: -1,
        });

        for (const item of orderDetails) {
          const product = await productService.readOne(item.product_id, {
            fields: ["id", "quantity"],
          });
          if (product) {
            await productService.updateOne(item.product_id, {
              quantity: product.quantity - item.quantity,
            });

            await cartService.deleteByQuery({
              filter: {
                _and: [
                  { owner: { _eq: order.owner } },
                  { product: { _eq: item.product_id } },
                ],
              },
            });
          }
        }

        await orderService.updateOne(order_id, { status: "paid" });
        res.json({ success: true });
      });
    } catch (error) {
      console.error("Webhook Error:", error);
      res.status(500).json({ error: error.message });
    }
  });
};
