export default (router, { services, database }) => {
  const { ItemsService } = services;

  function getDate(date, yearIndex) {
    const year = date.getFullYear().toString().substring(yearIndex);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}${month}${day}`;
  }

  async function generateSequence(knex, sequenceName) {
    await knex.raw(`CREATE SEQUENCE IF NOT EXISTS ${sequenceName}`);
    const result = await knex.raw(`SELECT nextval('${sequenceName}')`);
    return result.rows[0]?.nextval;
  }

  function generateRunningNumber(date, count, prefix, padding) {
    const runningNumber = count.toString().padStart(padding, '0');
    return `${prefix}${date}${runningNumber}`;
  }

  async function generateOrderNo(knex) {
    const prefix = 'AI-SK-';
    const dateStr = getDate(new Date(), 2);
    const seqName = `order_no_seq_${dateStr}`;
    const seq = await generateSequence(knex, seqName);
    return generateRunningNumber(dateStr, seq, prefix, 4);
  }

  router.post('/checkout', async (req, res) => {
    if (!req.accountability || !req.accountability.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userId = req.accountability.user;

    try {
      await database.transaction(async (trx) => {
        
        const cartService = new ItemsService('cart_detail', {
          schema: req.schema,
          accountability: req.accountability,
          knex: trx 
        });
        const orderService = new ItemsService('order', {
          schema: req.schema,
          accountability: req.accountability,
          knex: trx
        });
        const orderDetailService = new ItemsService('order_detail', {
          schema: req.schema,
          accountability: req.accountability,
          knex: trx
        });
        
        const adminCartService = new ItemsService('cart_detail', {
          schema: req.schema,
          accountability: { admin: true },
          knex: trx
        });

        const cartItems = await cartService.readByQuery({
          filter: { owner: { _eq: userId } },
          fields: ['id', 'quantity', 'product.id', 'product.price', 'product.name', 'product.quantity']
        });

        if (!cartItems || cartItems.length === 0) {
          throw new Error("Cart is empty");
        }

        let totalPrice = 0;
        const orderDetailsPayload = [];

        for (const item of cartItems) {
          if (!item.product) continue;

          if (item.product.quantity < item.quantity) {
             throw new Error(`Product "${item.product.name}" out of stock`);
          }

          totalPrice += (item.product.price * item.quantity);

          orderDetailsPayload.push({
            product: item.product.id,
            quantity: item.quantity,
            price_at_purchase: item.product.price
          });
        }

        const orderNo = await generateOrderNo(trx);

        const newOrder = await orderService.createOne({
          owner: userId,
          order_no: orderNo,
          order_date: new Date(),
          total_price: totalPrice,
        });

        const detailsWithOrderId = orderDetailsPayload.map(detail => ({
          ...detail,
          order_id: newOrder.id
        }));

        await orderDetailService.createMany(detailsWithOrderId);

        const cartIds = cartItems.map(c => c.id);
        await adminCartService.deleteMany(cartIds);

        res.json({
          success: true,
          order_id: newOrder.id,
          total_price: totalPrice
        });
      });

    } catch (error) {
      console.error("Checkout Error:", error);
      const status = error.message.includes("Cart is empty") || error.message.includes("out of stock") ? 400 : 500;
      res.status(status).json({ error: error.message });
    }
  });

  router.post('/payment-webhook', async (req, res) => {
    const { order_id, payment_status } = req.body;

    if (!order_id || payment_status !== 'success') {
      return res.status(400).json({ error: "Invalid payment data" });
    }

    const database = req.database;

    try {
      await database.transaction(async (trx) => {
        const adminAccountability = { admin: true };

        const orderDetailService = new ItemsService('order_detail', {
          schema: req.schema,
          accountability: adminAccountability,
          knex: trx
        });
        const productService = new ItemsService('product', {
          schema: req.schema,
          accountability: adminAccountability,
          knex: trx
        });

        const order = await orderService.readOne(order_id);
        
        if (order.status === 'paid') {
          return res.json({ message: "Order already paid" });
        }

        const orderDetails = await orderDetailService.readByQuery({
          filter: { order_id: { _eq: order_id } },
          fields: ['product', 'quantity']
        });

        for (const item of orderDetails) {
          const currentProduct = await productService.readOne(item.product);
          const newQuantity = currentProduct.quantity - item.quantity;

          if (newQuantity < 0) {
            throw new Error(`Stock update failed for product ${item.product} (Not enough stock)`);
          }

          await productService.updateOne(item.product, {
            quantity: newQuantity
          });
        }

        res.json({ success: true, message: "Payment confirmed, stock updated" });
      });

    } catch (error) {
      console.error("Payment Webhook Error:", error);
      res.status(500).json({ error: error.message });
    }
  });
};