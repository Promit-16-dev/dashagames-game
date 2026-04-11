// Подключаем Telegram
const tg = window.Telegram.WebApp;
tg.expand(); // Растягиваем на весь экран

// Получаем canvas
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Данные игрока из Telegram
let playerData = {
    name: 'Гость',
    photo: null,
    id: 'guest'
};

if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
    const user = tg.initDataUnsafe.user;
    playerData.name = user.first_name;
    playerData.photo = user.photo_url;
    playerData.id = user.id;
    
    // Показываем имя
    document.getElementById('playerName').textContent = playerData.name;
    
    // Показываем фото в меню
    if (playerData.photo) {
        const img = document.createElement('img');
        img.src = playerData.photo;
        img.style.width = '50px';
        img.style.height = '50px';
        img.style.borderRadius = '50%';
        document.getElementById('playerInfo').appendChild(img);
    }
    document.getElementById('playerInfo').innerHTML += `<br>${playerData.name}`;
}

// Игровые переменные
let gameRunning = false;
let score = 0;
let coins = 0;
let bestRecord = 0;

// Персонаж
let player = {
    x: 175,
    y: 300,
    vy: 0,
    radius: 15,
    color: '#FF6B6B',
    skin: 'default',
    hat: 'none'
};

// Платформы
let platforms = [];
let cameraY = 0;

// Статистика
let stats = {
    playTime: 0,
    attempts: 0,
    totalJumps: 0,
    totalCoins: 0
};

// Загружаем сохранения
function loadSavedData() {
    tg.CloudStorage.getItems(['coins', 'bestRecord', 'skin', 'hat', 'stats'], (err, values) => {
        if (!err) {
            coins = parseInt(values.coins) || 0;
            bestRecord = parseInt(values.bestRecord) || 0;
            player.skin = values.skin || 'default';
            player.hat = values.hat || 'none';
            if (values.stats) {
                stats = JSON.parse(values.stats);
            }
            updateCoinDisplay();
        }
    });
}

// Сохраняем данные
function saveData() {
    tg.CloudStorage.setItem('coins', coins.toString());
    tg.CloudStorage.setItem('bestRecord', bestRecord.toString());
    tg.CloudStorage.setItem('skin', player.skin);
    tg.CloudStorage.setItem('hat', player.hat);
    tg.CloudStorage.setItem('stats', JSON.stringify(stats));
}

// Обновляем отображение монет
function updateCoinDisplay() {
    document.getElementById('coinBalance').textContent = coins;
    document.getElementById('musicCoinBalance').textContent = coins;
}

// ============= ГЛАВНОЕ МЕНЮ =============
function showMainMenu() {
    document.getElementById('mainMenu').classList.remove('hidden');
    document.getElementById('skinShopScreen').classList.add('hidden');
    document.getElementById('statsScreen').classList.add('hidden');
    document.getElementById('musicScreen').classList.add('hidden');
    document.getElementById('leaderboardScreen').classList.add('hidden');
    document.getElementById('readyScreen').classList.add('hidden');
    document.getElementById('score').classList.add('hidden');
}

function backToMenu() {
    showMainMenu();
}

// ============= ЗАПУСК ИГРЫ =============
function startGame() {
    document.getElementById('mainMenu').classList.add('hidden');
    document.getElementById('readyScreen').classList.remove('hidden');
    
    // Сбрасываем игру
    score = 0;
    player.y = 300;
    player.vy = 0;
    platforms = [];
    cameraY = 0;
    
    // Создаём начальные платформы
    for (let i = 0; i < 10; i++) {
        createPlatform(100 + i * 80);
    }
    
    // Ждём тапа для старта
    setTimeout(() => {
        canvas.addEventListener('touchstart', function readyHandler() {
            document.getElementById('readyScreen').classList.add('hidden');
            document.getElementById('score').classList.remove('hidden');
            gameRunning = true;
            stats.attempts++;
            gameLoop();
            canvas.removeEventListener('touchstart', readyHandler);
        }, { once: true });
    }, 100);
}

// Создание платформы
function createPlatform(y) {
    const types = ['normal', 'normal', 'normal', 'fragile', 'spring', 'moving'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    platforms.push({
        x: Math.random() * (canvas.width - 80) + 40,
        y: y,
        width: 60,
        height: 10,
        type: type,
        hits: 0,
        broken: false,
        direction: Math.random() > 0.5 ? 1 : -1
    });
}

// ============= ИГРОВОЙ ЦИКЛ =============
function gameLoop() {
    if (!gameRunning) return;
    
    // Очищаем экран
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Обновляем физику
    player.vy += 0.5; // Гравитация
    player.y += player.vy;
    
    // Проверяем платформы
    for (let p of platforms) {
        if (p.broken) continue;
        
        // Рисуем платформу
        ctx.fillStyle = p.type === 'normal' ? '#4CAF50' : 
                        p.type === 'fragile' ? '#FFC107' :
                        p.type === 'spring' ? '#2196F3' : '#9C27B0';
        ctx.fillRect(p.x - cameraY * 0.1, p.y - cameraY, p.width, p.height);
        
        // Проверка столкновения
        if (player.y + player.radius > p.y && 
            player.y - player.radius < p.y + p.height &&
            player.x > p.x && player.x < p.x + p.width &&
            player.vy > 0) {
            
            // Прыжок
            if (p.type === 'spring') {
                player.vy = -15;
            } else {
                player.vy = -10;
            }
            
            // Ломающиеся платформы
            if (p.type === 'fragile') {
                p.hits++;
                if (p.hits >= 2) p.broken = true;
            }
            
            stats.totalJumps++;
            tg.HapticFeedback.impactOccurred('light');
        }
        
        // Движущиеся платформы
        if (p.type === 'moving') {
            p.x += p.direction * 2;
            if (p.x < 10 || p.x > canvas.width - p.width - 10) {
                p.direction *= -1;
            }
        }
    }
    
    // Камера следует за игроком
    if (player.y < cameraY + 200) {
        cameraY = player.y - 200;
        score = Math.floor(-cameraY / 10);
        document.getElementById('score').textContent = score + 'м';
        
        // Создаём новые платформы
        if (platforms.length < 20) {
            createPlatform(cameraY - 50);
        }
    }
    
    // Рисуем персонажа (кружок)
    ctx.beginPath();
    ctx.arc(player.x, player.y - cameraY, player.radius, 0, Math.PI * 2);
    
    // Применяем выбранный цвет
    if (player.skin === 'default') ctx.fillStyle = '#FF6B6B';
    else if (player.skin === 'neon') ctx.fillStyle = '#00FF88';
    else if (player.skin === 'gold') ctx.fillStyle = '#FFD700';
    else ctx.fillStyle = player.color;
    
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Проверка Game Over
    if (player.y - cameraY > canvas.height + 50) {
        gameOver();
        return;
    }
    
    requestAnimationFrame(gameLoop);
}

// ============= КОНЕЦ ИГРЫ =============
function gameOver() {
    gameRunning = false;
    
    if (score > bestRecord) {
        bestRecord = score;
        saveData();
    }
    
    stats.playTime += 10; // Упрощённо
    
    // Показываем результат
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.font = '30px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Игра окончена!', canvas.width/2, canvas.height/2 - 50);
    ctx.fillText('Рекорд: ' + bestRecord + 'м', canvas.width/2, canvas.height/2);
    ctx.font = '20px Arial';
    ctx.fillText('Нажмите чтобы продолжить', canvas.width/2, canvas.height/2 + 50);
    
    canvas.addEventListener('touchstart', function restart() {
        showMainMenu();
        canvas.removeEventListener('touchstart', restart);
    }, { once: true });
}

// ============= МАГАЗИН СКИНОВ =============
function showSkinShop() {
    document.getElementById('mainMenu').classList.add('hidden');
    document.getElementById('skinShopScreen').classList.remove('hidden');
    
    const skinsHTML = `
        <div class="skin-item">
            <span>🔴 Классический</span>
            <div class="color-preview" style="background: #FF6B6B;"></div>
            <button onclick="selectSkin('default')">Выбрать</button>
        </div>
        <div class="skin-item">
            <span>💚 Неоновый (100🪙)</span>
            <div class="color-preview" style="background: #00FF88;"></div>
            <button onclick="buySkin('neon', 100)">Купить</button>
        </div>
        <div class="skin-item">
            <span>👑 Золотой (500🪙)</span>
            <div class="color-preview" style="background: #FFD700;"></div>
            <button onclick="buySkin('gold', 500)">Купить</button>
        </div>
    `;
    
    document.getElementById('skinsList').innerHTML = skinsHTML;
    
    const hatsHTML = `
        <div class="skin-item">
            <span>Без шляпы</span>
            <button onclick="selectHat('none')">Выбрать</button>
        </div>
        <div class="skin-item">
            <span>🧢 Кепка (Рекорд 100м)</span>
            <button onclick="buyHat('cap', 100)">${bestRecord >= 100 ? 'Выбрать' : '🔒'}</button>
        </div>
        <div class="skin-item">
            <span>👑 Корона (Рекорд 500м)</span>
            <button onclick="buyHat('crown', 500)">${bestRecord >= 500 ? 'Выбрать' : '🔒'}</button>
        </div>
    `;
    
    document.getElementById('hatsList').innerHTML = hatsHTML;
}

function selectSkin(skinId) {
    player.skin = skinId;
    saveData();
    alert('Скин выбран!');
}

function buySkin(skinId, price) {
    if (coins >= price) {
        coins -= price;
        player.skin = skinId;
        saveData();
        updateCoinDisplay();
        alert('Скин куплен!');
    } else {
        alert('Недостаточно монет!');
    }
}

function selectHat(hatId) {
    player.hat = hatId;
    saveData();
    alert('Шляпа выбрана!');
}

function buyHat(hatId, requiredRecord) {
    if (bestRecord >= requiredRecord) {
        player.hat = hatId;
        saveData();
        alert('Шляпа разблокирована!');
    } else {
        alert(`Нужен рекорд ${requiredRecord}м!`);
    }
}

// ============= ЗАГРУЗКА СВОЕГО ФОТО =============
function uploadCustomPhoto() {
    const fileInput = document.getElementById('photoUpload');
    const file = fileInput.files[0];
    
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            // Сохраняем фото как кастомный скин
            player.color = e.target.result;
            player.skin = 'custom';
            saveData();
            alert('Фото загружено! Теперь ваш кружок с вашим фото!');
        };
        reader.readAsDataURL(file);
    }
}

// ============= ЗАГРУЗКА СВОЕЙ МУЗЫКИ =============
function uploadCustomMusic() {
    const fileInput = document.getElementById('musicUpload');
    const file = fileInput.files[0];
    
    if (file) {
        const audio = new Audio();
        audio.src = URL.createObjectURL(file);
        audio.loop = true;
        audio.volume = 0.3;
        
        // Сохраняем в памяти браузера
        localStorage.setItem('customMusic', audio.src);
        
        alert('Музыка загружена! Нажмите на экран чтобы запустить.');
        
        // Запускаем по первому тапу
        document.addEventListener('touchstart', function playMusic() {
            audio.play();
            document.removeEventListener('touchstart', playMusic);
        }, { once: true });
    }
}

// ============= СТАТИСТИКА =============
function showStats() {
    document.getElementById('mainMenu').classList.add('hidden');
    document.getElementById('statsScreen').classList.remove('hidden');
    
    const hours = Math.floor(stats.playTime / 3600);
    const minutes = Math.floor((stats.playTime % 3600) / 60);
    
    document.getElementById('statsContent').innerHTML = `
        <p>🎮 Всего попыток: ${stats.attempts}</p>
        <p>⏱️ Время в игре: ${hours}ч ${minutes}м</p>
        <p>🏆 Лучший рекорд: ${bestRecord}м</p>
        <p>🦘 Всего прыжков: ${stats.totalJumps}</p>
        <p>🪙 Монет собрано: ${stats.totalCoins}</p>
    `;
}

// ============= МУЗЫКА =============
function showMusicShop() {
    document.getElementById('mainMenu').classList.add('hidden');
    document.getElementById('musicScreen').classList.remove('hidden');
    
    document.getElementById('musicList').innerHTML = `
        <div class="skin-item">
            <span>🔇 Без музыки</span>
            <button onclick="selectMusic('none')">Выбрать</button>
        </div>
        <div class="skin-item">
            <span>🎵 Ретро (200🪙)</span>
            <button onclick="buyMusic('retro', 200)">Купить</button>
        </div>
    `;
}

function selectMusic(musicId) {
    alert('Музыка выбрана!');
}

function buyMusic(musicId, price) {
    if (coins >= price) {
        coins -= price;
        saveData();
        updateCoinDisplay();
        alert('Музыка куплена!');
    } else {
        alert('Недостаточно монет!');
    }
}

// ============= ТОП 10 =============
function showLeaderboard() {
    document.getElementById('mainMenu').classList.add('hidden');
    document.getElementById('leaderboardScreen').classList.remove('hidden');
    
    // Здесь показываем топ игроков
    let html = '';
    
    // Добавляем текущего игрока
    if (playerData.photo) {
        html += `<div style="display: flex; align-items: center; margin: 10px 0;">
            <img src="${playerData.photo}" style="width: 40px; height: 40px; border-radius: 50%; margin-right: 10px;">
            <span>${playerData.name}</span>
            <span style="margin-left: auto;">${bestRecord}м</span>
        </div>`;
    }
    
    document.getElementById('leaderboardList').innerHTML = html || '<p>Пока нет рекордов</p>';
}

// ============= УПРАВЛЕНИЕ =============
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (gameRunning) {
        // Двигаем игрока влево/вправо
        const touchX = e.touches[0].clientX;
        if (touchX < canvas.width / 2) {
            player.x = Math.max(20, player.x - 30);
        } else {
            player.x = Math.min(canvas.width - 20, player.x + 30);
        }
    }
});

// Загружаем данные при старте
loadSavedData();
showMainMenu();
