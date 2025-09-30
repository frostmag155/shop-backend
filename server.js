const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const path = require("path");

// Настройка подключения к базе данных (как в вашем работающем коде)
const pool = mysql.createPool({
  host: 'MySQL-8.2',  // Меняем обратно на MySQL-8.2
  user: 'root',
  password: '', 
  database: 'shop',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const app = express();

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Проверка подключения к базе данных
pool.getConnection()
  .then(connection => {
    console.log("✅ Подключено к базе данных MySQL");
    console.log("📊 База данных: shop");
    connection.release();
  })
  .catch(err => {
    console.error("❌ Ошибка подключения к БД:", err.message);
    console.log("💡 Проверьте:");
    console.log("   - Запущен ли MySQL сервер");
    console.log("   - Правильность имени хоста: MySQL-8.2");
    console.log("   - Доступность phpMyAdmin");
  });

const PORT = 5000;

// Базовый маршрут для проверки
app.get('/', (req, res) => {
  res.json({ 
    message: 'Сервер работает!', 
    timestamp: new Date().toISOString(),
    database: {
      host: 'MySQL-8.2',
      status: 'Проверяем подключение...'
    }
  });
});
// Тестовый маршрут для проверки БД
app.get('/test-db', async (req, res) => {
  try {
    const [result] = await pool.query('SELECT 1 as test');
    res.json({ 
      success: true, 
      message: 'База данных подключена',
      test: result 
    });
  } catch (error) {
    res.json({ 
      success: false, 
      message: 'Ошибка подключения к БД',
      error: error.message 
    });
  }
});

// Получение всех товаров
app.get('/products', async (req, res) => {
  try {
    console.log('📦 Запрос на получение товаров');
    const [products] = await pool.query('SELECT name, category, price, image FROM tovar');
    
    // Логируем результат для отладки
    console.log(`✅ Найдено товаров: ${products.length}`);
    
    res.json(products);
  } catch (err) {
    console.error('❌ Ошибка при получении товаров:', err);
    res.status(500).json({ error: 'Ошибка сервера при получении товаров' });
  }
});

// Получение вариантов товара
app.get('/variants/:model', async (req, res) => {
  try {
    const model = decodeURIComponent(req.params.model);
    console.log(`🔍 Запрос вариантов для: ${model}`);
    
    const [variants] = await pool.query(
      'SELECT color, memory, price, image, screen_size, ram, band_size, dial_size FROM variants WHERE product_name = ?',
      [model]
    );
    
    res.json(variants);
  } catch (err) {
    console.error('❌ Ошибка при получении вариантов:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получение характеристик товара
app.get('/specs/:model', async (req, res) => {
  try {
    const model = decodeURIComponent(req.params.model);
    const [specs] = await pool.query(
      'SELECT name, value FROM specs WHERE product_name = ?',
      [model]
    );
    res.json(specs);
  } catch (err) {
    console.error('❌ Ошибка при получении характеристик:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получение страновых особенностей
app.get('/country-features/:model', async (req, res) => {
  try {
    const model = decodeURIComponent(req.params.model);
    const [features] = await pool.query(
      'SELECT country_code, description FROM country_features WHERE product_name = ?',
      [model]
    );
    res.json(features);
  } catch (err) {
    console.error('❌ Ошибка при получении countryFeatures:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Авторизация
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email и пароль обязательны'
      });
    }

    const [users] = await pool.query(
      'SELECT id, name, second_name, email FROM users WHERE email = ? AND password = ?',
      [email, password]
    );

    if (users.length > 0) {
      res.json({ 
        success: true, 
        user: users[0] 
      });
    } else {
      res.status(401).json({ 
        success: false, 
        message: 'Неверный email или пароль' 
      });
    }
  } catch (err) {
    console.error('❌ Ошибка при входе:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Ошибка сервера' 
    });
  }
});

// Регистрация
app.post('/register', async (req, res) => {
  try {
    const { name, second_name, email, password } = req.body;

    if (!name || !second_name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Заполните все поля'
      });
    }

    // Проверка на существующий email
    const [existingUsers] = await pool.query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Email уже зарегистрирован'
      });
    }

    // Добавление нового пользователя
    await pool.query(
      'INSERT INTO users (name, second_name, email, password) VALUES (?, ?, ?, ?)',
      [name, second_name, email, password]
    );

    res.json({
      success: true,
      message: 'Регистрация прошла успешно'
    });

  } catch (error) {
    console.error('❌ Ошибка регистрации:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера'
    });
  }
});

// Получение ID варианта товара
app.post('/get-variant-id', async (req, res) => {
  try {
    const { model, color, memory, screen_size, ram, band_size, dial_size } = req.body;

    const isWatch = model && model.toLowerCase().includes('watch');

    if (!model) {
      return res.status(400).json({
        success: false,
        message: 'Параметр model обязателен'
      });
    }

    if (!color) {
      return res.status(400).json({
        success: false,
        message: 'Параметр color обязателен'
      });
    }

    if (!isWatch && !memory) {
      return res.status(400).json({
        success: false,
        message: 'Для этого товара параметр memory обязателен'
      });
    }

    let query = `SELECT id FROM variants WHERE product_name = ? AND color = ?`;
    let params = [model, color];

    if (!isWatch && memory) {
      query += ` AND memory = ?`;
      params.push(memory);
    }

    if (screen_size) {
      query += ` AND screen_size = ?`;
      params.push(screen_size);
    }

    if (ram) {
      query += ` AND ram = ?`;
      params.push(ram);
    }

    if (isWatch) {
      if (band_size) {
        query += ` AND band_size = ?`;
        params.push(band_size);
      }

      if (dial_size) {
        query += ` AND dial_size = ?`;
        params.push(dial_size);
      }
    }

    query += ` LIMIT 1`;

    const [rows] = await pool.query(query, params);

    if (rows.length > 0) {
      return res.json({
        success: true,
        variantId: rows[0].id
      });
    } else {
      return res.json({
        success: false,
        message: 'Вариант товара не найден'
      });
    }
  } catch (error) {
    console.error('❌ Error in /get-variant-id:', error);
    return res.status(500).json({
      success: false,
      message: 'Внутренняя ошибка сервера'
    });
  }
});

// Работа с корзиной
app.post('/save-cart', async (req, res) => {
  try {
    const { userId, cartItems } = req.body;

    if (!cartItems || cartItems.length === 0) {
      await pool.query('DELETE FROM cart WHERE user_id = ?', [userId]);
      return res.json({ success: true });
    }

    await pool.query('START TRANSACTION');
    await pool.query('DELETE FROM cart WHERE user_id = ?', [userId]);

    const values = cartItems
      .filter(item => item.variantId)
      .map(item => [
        userId,
        item.variantId,
        item.model || '',
        item.color || null,
        item.memory || null,
        item.image || '',
        item.quantity || 1,
        item.price || 0
      ]);

    if (values.length === 0) {
      await pool.query('COMMIT');
      return res.json({ success: true });
    }

    const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(',');

    await pool.query(
      `INSERT INTO cart (user_id, variant_id, product_name, color, memory, image_url, quantity, price) VALUES ${placeholders}`,
      values.flat()
    );

    await pool.query('COMMIT');
    res.json({ success: true });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('❌ Ошибка сохранения корзины:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера'
    });
  }
});

app.get('/get-cart', async (req, res) => {
  try {
    const userId = req.query.userId;

    const [cartItems] = await pool.query(`
      SELECT c.*, v.color, v.memory 
      FROM cart c
      JOIN variants v ON c.variant_id = v.id
      WHERE c.user_id = ?
    `, [userId]);

    res.json({
      success: true,
      cart: cartItems.map(item => ({
        variantId: item.variant_id,
        model: item.product_name,
        color: item.color,
        memory: item.memory,
        image: item.image_url,
        quantity: item.quantity,
        price: item.price
      }))
    });
  } catch (error) {
    console.error('❌ Ошибка загрузки корзины:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

app.post('/clear-cart', async (req, res) => {
  try {
    const { userId } = req.body;
    await pool.query('DELETE FROM cart WHERE user_id = ?', [userId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Оформление заказа
app.post('/api/process-order', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { firstName, lastName, email, phone, cart, userId = null, totalAmount } = req.body;

    if (isNaN(totalAmount)) {
      throw new Error('Некорректная сумма заказа');
    }

    await connection.beginTransaction();

    const [order] = await connection.execute(
      `INSERT INTO orders (user_id, first_name, last_name, email, phone, total_amount, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [userId, firstName, lastName, email, phone, totalAmount]
    );

    for (const item of cart) {
      await connection.execute(
        `INSERT INTO order_items (order_id, variant_id, model, category, color, memory, country, price, quantity) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          order.insertId,
          item.variantId,
          item.model,
          item.category,
          item.color,
          item.memory,
          item.country,
          item.price,
          item.quantity
        ]
      );
    }

    await connection.commit();

    res.json({
      success: true,
      orderId: order.insertId,
      totalAmount: totalAmount
    });

  } catch (error) {
    await connection.rollback();
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
  console.log(`📊 Проверьте работу: http://localhost:${PORT}/`);
  console.log(`🛍️  API товаров: http://localhost:${PORT}/products`);
  console.log(`🗄️  Проверка БД: http://localhost:${PORT}/test-db`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Порт ${PORT} уже занят!`);
  } else {
    console.error('❌ Ошибка запуска сервера:', err.message);
  }
});