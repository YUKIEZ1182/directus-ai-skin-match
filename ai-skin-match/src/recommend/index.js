import axios from 'axios';

export default (router, { services, env }) => {
  const { ItemsService } = services;

  const filterAndRankProducts = (products, targetIngredients, minimumMatch = 2) => {
    let rankedProducts = products.map(product => {
        let matchScore = 0;
        const productIngredientList = (product.ingredients || []).map(item => 
          item.ingredient_id?.name?.toLowerCase() || ""
        );
        
        targetIngredients.forEach(target => {
            if (productIngredientList.some(productIngredient => productIngredient.includes(target.toLowerCase()))) {
                matchScore++;
            }
        });
        return { ...product, match_score: matchScore };
    });

    const highScorerProducts = rankedProducts.filter(product => product.match_score >= minimumMatch);
    
    let finalResultList = highScorerProducts.length > 0 ? highScorerProducts : rankedProducts.filter(product => product.match_score >= 1);

    finalResultList.sort((firstItem, secondItem) => {
        if (secondItem.match_score !== firstItem.match_score) {
            return secondItem.match_score - firstItem.match_score;
        }
        const dateFirst = new Date(firstItem.date_updated || firstItem.date_created || 0);
        const dateSecond = new Date(secondItem.date_updated || secondItem.date_created || 0);
        return dateSecond - dateFirst;
    });

    return finalResultList.slice(0, 12);
  };

router.get('/product-for-skin-type', async (request, response) => {
    
    if (!request.accountability || !request.accountability.user) {
      return response.status(401).json({ error: "Unauthorized: Please log in." });
    }

    try {
      const categoryId = request.query.category;

      const usersService = new ItemsService('directus_users', { 
        schema: request.schema, 
        accountability: request.accountability
      });

      const currentUser = await usersService.readOne(request.accountability.user, {
        fields: ['skin_type']
      });

      if (!currentUser.skin_type) {
        return response.status(400).json({ 
          error: "User has no skin type specified.",
          action: "Please update your profile with a skin type."
        });
      }

      const PYTHON_API_URL = env.PYTHON_API_URL || 'http://host.docker.internal:5000';
      
      let recommendedIngredients = [];
      try {
        const modelResponse = await axios.get(`${PYTHON_API_URL}/skin-type-recommend`, {
          params: { skinType: currentUser.skin_type }
        });
        
        recommendedIngredients = modelResponse.data.recommendedIngredients || [];

      } catch (error) {
        console.error("Python Model API Error:", error.message);
        if (error.response) console.error("Debug:", error.response.data);
        return response.status(503).json({ error: "Cannot connect to recommendation model." });
      }

      if (recommendedIngredients.length === 0) {
        return response.json({ count: 0, data: [] });
      }

      const ingredientFilter = {
        _or: recommendedIngredients.map(ingredient => ({
          ingredients: {
            ingredient_id: {
              name: { _icontains: ingredient }
            }
          }
        }))
      };

      let finalFilter = ingredientFilter;

      if (categoryId && categoryId !== 'home' && categoryId !== 'new') {
        finalFilter = {
          _and: [
            ingredientFilter,
            { 
              categories: { 
                category_id: { 
                  id: { _eq: categoryId }
                } 
              } 
            }
          ]
        };
      }

      const productService = new ItemsService('product', { 
        schema: request.schema, 
        accountability: request.accountability 
      });

      const products = await productService.readByQuery({
        filter: finalFilter,
        limit: -1,
        fields: ['*', 'ingredients.ingredient_id.name'] 
      });
      
      const finalRecommendedProducts = filterAndRankProducts(products, recommendedIngredients, 2);

      response.json({
        user_skin_type: currentUser.skin_type,
        filter_category: categoryId || 'all',
        recommended_ingredients: recommendedIngredients,
        count: finalRecommendedProducts.length,
        data: finalRecommendedProducts
      });

    } catch (error) {
      console.error("Endpoint Error:", error);
      response.status(500).json({ error: error.message });
    }
  });

  router.get('/similar-product', async (request, response) => {
    const productId = request.query.product_id;

    if (!productId) {
      return response.status(400).json({ error: "Please provide a product_id" });
    }

    try {
      const productService = new ItemsService('product', { 
        schema: request.schema, 
        accountability: request.accountability 
      });

      const sourceProduct = await productService.readOne(productId, {
        fields: ['id', 'name', 'category', 'ingredients.ingredient_id.name']
      });

      if (!sourceProduct) {
        return response.status(404).json({ error: "Product not found" });
      }

      const sourceIngredients = (sourceProduct.ingredients || []).map(item => 
        item.ingredient_id?.name?.toLowerCase() || ""
      ).filter(name => name !== "");

      if (sourceIngredients.length === 0) {
        return response.json({ count: 0, data: [] });
      }

      const PYTHON_API_URL = env.PYTHON_API_URL || 'http://host.docker.internal:5000';
      
      let associationRules = [];
      try {
        const modelResponse = await axios.get(`${PYTHON_API_URL}/related-ingredients-recommend`, {
          params: { ingredient: sourceIngredients.join(',') }
        });
        associationRules = modelResponse.data || [];
      } catch (error) {
        console.error("Python API Error:", error.message);
        return response.status(503).json({ error: "Cannot connect to association model." });
      }

      if (associationRules.length === 0) {
        return response.json({ count: 0, data: [] });
      }

      const associatedIngredientsSet = new Set();
      
      associationRules.forEach(rule => {
        const allIngredientsInRule = [...rule.antecedents, ...rule.consequents];
        allIngredientsInRule.forEach(ingredient => {
            const ingredientLower = ingredient.toLowerCase();
            if (!sourceIngredients.includes(ingredientLower)) {
                associatedIngredientsSet.add(ingredientLower);
            }
        });
      });

      const targetIngredientsList = Array.from(associatedIngredientsSet);

      if (targetIngredientsList.length === 0) {
        return response.json({ count: 0, data: [] });
      }

      const productFilter = {
        _and: [
          {
            _or: targetIngredientsList.map(ingredient => ({
              ingredients: {
                ingredient_id: {
                  name: { _icontains: ingredient }
                }
              }
            }))
          },
          { id: { _neq: productId } },
          { category: { _eq: sourceProduct.category } }
        ]
      };

      const recommendedProducts = await productService.readByQuery({
        filter: productFilter,
        limit: -1, 
        fields: ['*', 'ingredients.ingredient_id.name']
      });

      const finalSimilarProducts = filterAndRankProducts(recommendedProducts, targetIngredientsList, 2);

      response.json({
        source_product: sourceProduct.name,
        source_category: sourceProduct.category,
        associated_ingredients_found: targetIngredientsList,
        count: finalSimilarProducts.length,
        data: finalSimilarProducts
      });

    } catch (error) {
      console.error("Association Endpoint Error:", error);
      response.status(500).json({ error: error.message });
    }
  });

  router.post('/trigger-retrain', async (req, res) => {
      if (!req.accountability || !req.accountability.admin) {
          return res.status(403).json({ error: "Forbidden: Admin only." });
      }

      try {
          const PYTHON_API_URL = env.PYTHON_API_URL;
          const responseFromPython = await axios.post(`${PYTHON_API_URL}/retrain`);
          return res.json(responseFromPython.data);
      } catch (error) {
          console.error("Manual Retrain Error:", error.message);
          return res.status(500).json({ error: "Failed to trigger retraining." });
      }
  });

  router.post('/switch-model', async (req, res) => {
      if (!req.accountability || !req.accountability.admin) {
          return res.status(403).json({ error: "Forbidden: Admin only." });
      }

      const { id } = req.body;
      if (!id) return res.status(400).json({ error: "Missing log ID" });

      try {
          const logService = new ItemsService('model_training_log', { 
              schema: req.schema, 
              accountability: req.accountability 
          });

          const activeLogs = await logService.readByQuery({
              filter: { is_active: { _eq: true } },
              fields: ['id']
          });

          for (const log of activeLogs) {
              await logService.updateOne(log.id, { is_active: false });
          }

          await logService.updateOne(id, { is_active: true });

          const PYTHON_API_URL = env.PYTHON_API_URL;
          try {
              await axios.get(`${PYTHON_API_URL}/reload`); 
          } catch (e) {
              console.warn("Python reload triggered but failed (ignore if endpoint not exists)");
          }

          return res.json({ success: true, message: "Model switched successfully" });
      } catch (error) {
          return res.status(500).json({ error: error.message });
      }
  });
};