import axios from 'axios';

export default (router, { services, env, exceptions }) => {
  const { ItemsService } = services;

  const filterAndRankProducts = (products, targetIngredients, minMatch = 2) => {
    let ranked = products.map(product => {
        let matchScore = 0;
        const productIngList = (product.ingredients || []).map(item => 
          item.ingredient_id?.name?.toLowerCase() || ""
        );
        
        targetIngredients.forEach(target => {
            if (productIngList.some(pIng => pIng.includes(target.toLowerCase()))) {
                matchScore++;
            }
        });
        return { ...product, match_score: matchScore };
    });

    const highScorers = ranked.filter(p => p.match_score >= minMatch);
    
    let finalResult = highScorers.length > 0 ? highScorers : ranked.filter(p => p.match_score >= 1);

    finalResult.sort((a, b) => {
        if (b.match_score !== a.match_score) {
            return b.match_score - a.match_score;
        }
        const dateA = new Date(a.date_updated || a.date_created || 0);
        const dateB = new Date(b.date_updated || b.date_created || 0);
        return dateB - dateA;
    });

    return finalResult.slice(0, 12);
  };

  router.get('/product-for-skin-type', async (req, res) => {
    
    if (!req.accountability || !req.accountability.user) {
      return res.status(401).json({ error: "Unauthorized: Please log in." });
    }

    try {
      const usersService = new ItemsService('directus_users', { 
        schema: req.schema, 
        accountability: req.accountability
      });

      const user = await usersService.readOne(req.accountability.user, {
        fields: ['skin_type']
      });

      if (!user.skin_type) {
        return res.status(400).json({ 
          error: "User has no skin_type specified.",
          action: "Please update your profile with a skin type."
        });
      }

      const PYTHON_API_URL = env.PYTHON_API_URL || 'http://host.docker.internal:5000';
      
      let recommendedIngredients = [];
      try {
        const modelResponse = await axios.get(`${PYTHON_API_URL}/skin-type-recommend`, {
          params: { skin_type: user.skin_type }
        });
        
        recommendedIngredients = modelResponse.data.recommended_ingredients || [];

      } catch (error) {
        console.error("Python Model API Error:", error.message);
        return res.status(503).json({ error: "Cannot connect to recommendation model." });
      }

      if (recommendedIngredients.length === 0) {
        return res.json({ count: 0, data: [] });
      }

      const productFilter = {
        _or: recommendedIngredients.map(ing => ({
          ingredients: {
            ingredient_id: {
              name: { _icontains: ing }
            }
          }
        }))
      };

      const productService = new ItemsService('product', { 
        schema: req.schema, 
        accountability: req.accountability 
      });

      const products = await productService.readByQuery({
        filter: productFilter,
        limit: -1,
        fields: ['*', 'ingredients.ingredient_id.name'] 
      });
      
      const finalProducts = filterAndRankProducts(products, recommendedIngredients, 2);

      res.json({
        user_skin_type: user.skin_type,
        recommended_ingredients: recommendedIngredients,
        count: finalProducts.length,
        data: finalProducts
      });

    } catch (error) {
      console.error("Endpoint Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/similar-product', async (req, res) => {
    const productId = req.query.product_id;

    if (!productId) {
      return res.status(400).json({ error: "Please provide a product_id" });
    }

    try {
      const { ItemsService } = services;

      const productService = new ItemsService('product', { 
        schema: req.schema, 
        accountability: req.accountability 
      });

      const sourceProduct = await productService.readOne(productId, {
        fields: ['id', 'name', 'ingredients.ingredient_id.name']
      });

      if (!sourceProduct) {
        return res.status(404).json({ error: "Product not found" });
      }

      const sourceIngredients = (sourceProduct.ingredients || []).map(item => 
        item.ingredient_id?.name?.toLowerCase() || ""
      ).filter(name => name !== "");

      if (sourceIngredients.length === 0) {
        return res.json({ count: 0, data: [] });
      }

      const PYTHON_API_URL = env.PYTHON_API_URL || 'http://host.docker.internal:5000';
      
      let rules = [];
      try {
        const response = await axios.get(`${PYTHON_API_URL}/rules`, {
          params: { ingredient: sourceIngredients.join(',') }
        });
        rules = response.data || [];
      } catch (error) {
        console.error("Python API Error:", error.message);
        return res.status(503).json({ error: "Cannot connect to association model." });
      }

      if (rules.length === 0) {
        return res.json({ count: 0, data: [] });
      }

      const associatedIngredients = new Set();
      
      rules.forEach(rule => {
        const allInRule = [...rule.antecedents, ...rule.consequents];
        allInRule.forEach(ing => {
            const ingLower = ing.toLowerCase();
            if (!sourceIngredients.includes(ingLower)) {
                associatedIngredients.add(ingLower);
            }
        });
      });

      const targetIngredients = Array.from(associatedIngredients);

      if (targetIngredients.length === 0) {
        return res.json({ count: 0, data: [] });
      }

      const productFilter = {
        _or: targetIngredients.map(ing => ({
          ingredients: {
            ingredient_id: {
              name: { _icontains: ing }
            }
          }
        })),
        id: { _neq: productId }
      };

      const recommendedProducts = await productService.readByQuery({
        filter: productFilter,
        limit: -1, 
        fields: ['*', 'ingredients.ingredient_id.name']
      });

      const finalProducts = filterAndRankProducts(recommendedProducts, targetIngredients, 2);

      res.json({
        source_product: sourceProduct.name,
        associated_ingredients_found: targetIngredients,
        count: finalProducts.length,
        data: finalProducts
      });

    } catch (error) {
      console.error("Association Endpoint Error:", error);
      res.status(500).json({ error: error.message });
    }
  });
};