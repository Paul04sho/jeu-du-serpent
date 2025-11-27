// SELECTION DES ELEMENTS
let dom_replay = document.querySelector("#replay");
let dom_score = document.querySelector("#score");
let dom_canvas = document.createElement("canvas");
document.querySelector("#canvas").appendChild(dom_canvas);
let CTX = dom_canvas.getContext("2d");

const width = (dom_canvas.width = 400);
const height = (dom_canvas.height = 400);

let nameOfPlayer = document.getElementById("username");
let startGameButton = document.getElementById("playBtn");

// VARIABLES DU JEU
let snake,
    food,
    currentHue,
    cells = 20,
    cellSize,
    isGameOver = false,
    score = 0,
    maxScore = window.localStorage.getItem("maxScore" || undefined),
    particles = [],
    splashingParticleCount = 20,
    cellsCount,
    requestID;

// AFFICHER LE CANVAS
startGameButton.addEventListener("click", () => {
    if (nameOfPlayer.value.trim() !== "") {
        document.querySelector(".start-screen").classList.add("hidden");
        document.querySelector(".wrapper").classList.remove("hidden");
    } else {
        alert("Remplissez le champ de saisie");
    }
});

// HELPERS
let helpers = {
    Vec: class {
        constructor(x, y) {
            this.x = x;
            this.y = y;
        }
        add(v) {
            this.x += v.x;
            this.y += v.y;
            return this;
        }
        mult(v) {
            if (v instanceof helpers.Vec) {
                this.x *= v.x;
                this.y *= v.y;
                return this;
            } else {
                this.x *= v;
                this.y *= v;
                return this;
            }
        }
    },

    isCollision(v1, v2) {
        return v1.x == v2.x && v1.y == v2.y;
    },

    garbageCollector() {
        for (let i = 0; i < particles.length; i++) {
            if (particles[i].size <= 0) {
                particles.splice(i, 1);
            }
        }
    },

    drawGrid() {
        CTX.lineWidth = 1.1;
        CTX.strokeStyle = "#232332";
        CTX.shadowBlur = 0;
        for (let i = 0; i < cells; i++) {
            let f = (width / cells) * i;
            CTX.beginPath();
            CTX.moveTo(f, 0);
            CTX.lineTo(f, height);
            CTX.stroke();
            CTX.beginPath();
            CTX.moveTo(0, f);
            CTX.lineTo(width, f);
            CTX.stroke();
            CTX.closePath();
        }
    },

    randHue() {
        return ~~(Math.random() * 360);
    }
};

// CONTROLES
let KEY = {
    ArrowUp: false,
    ArrowRight: false,
    ArrowDown: false,
    ArrowLeft: false,

    resetState() {
        this.ArrowUp = false;
        this.ArrowRight = false;
        this.ArrowDown = false;
        this.ArrowLeft = false;
    },

    listen() {
        addEventListener(
            "keydown",
            (e) => {
                if (e.key === "ArrowUp" && this.ArrowDown) return;
                if (e.key === "ArrowDown" && this.ArrowUp) return;
                if (e.key === "ArrowLeft" && this.ArrowRight) return;
                if (e.key === "ArrowRight" && this.ArrowLeft) return;
                this[e.key] = true;

                Object.keys(this)
                    .filter((k) => k !== e.key && k !== "listen" && k !== "resetState")
                    .forEach((k) => (this[k] = false));
            },
            false
        );
    }
};

// SNAKE
class Snake {
    constructor() {
        this.pos = new helpers.Vec(width / 2, height / 2);
        this.dir = new helpers.Vec(0, 0);
        this.delay = 5;
        this.size = width / cells;
        this.color = "white";
        this.history = [];
        this.total = 1;
    }

    draw() {
        let { x, y } = this.pos;
        CTX.fillStyle = this.color;
        CTX.shadowBlur = 20;
        CTX.shadowColor = "rgba(255,255,255,0.3)";
        CTX.fillRect(x, y, this.size, this.size);
        CTX.shadowBlur = 0;

        if (this.total >= 2) {
            for (let i = 0; i < this.history.length - 1; i++) {
                let { x, y } = this.history[i];
                CTX.fillRect(x, y, this.size, this.size);
            }
        }
    }

    walls() {
        let { x, y } = this.pos;
        if (x + cellSize > width) this.pos.x = 0;
        if (y + cellSize > height) this.pos.y = 0;
        if (y < 0) this.pos.y = height - cellSize;
        if (x < 0) this.pos.x = width - cellSize;
    }

    controlls() {
        let dir = this.size;
        if (KEY.ArrowUp) this.dir = new helpers.Vec(0, -dir);
        if (KEY.ArrowDown) this.dir = new helpers.Vec(0, dir);
        if (KEY.ArrowLeft) this.dir = new helpers.Vec(-dir, 0);
        if (KEY.ArrowRight) this.dir = new helpers.Vec(dir, 0);
    }

    selfCollision() {
        for (let i = 0; i < this.history.length; i++) {
            if (helpers.isCollision(this.pos, this.history[i])) {
                isGameOver = true;
            }
        }
    }

    update() {
        this.walls();
        this.draw();
        this.controlls();

        if (!this.delay--) {
            if (helpers.isCollision(this.pos, food.pos)) {
                incrementScore();
                particleSplash();
                food.spawn();
                this.total++;
            }

            this.history[this.total - 1] = new helpers.Vec(this.pos.x, this.pos.y);

            for (let i = 0; i < this.total - 1; i++) {
                this.history[i] = this.history[i + 1];
            }

            this.pos.add(this.dir);
            this.delay = 5;

            if (this.total > 3) this.selfCollision();
        }
    }
}

// FOOD
class Food {
    constructor() {
        this.size = cellSize;
        this.spawn();
    }

    spawn() {
        let randX = ~~(Math.random() * cells) * this.size;
        let randY = ~~(Math.random() * cells) * this.size;

        for (let path of snake.history) {
            if (helpers.isCollision(new helpers.Vec(randX, randY), path)) {
                return this.spawn();
            }
        }

        this.color = currentHue = `hsl(${helpers.randHue()},100%,50%)`;
        this.pos = new helpers.Vec(randX, randY);
    }

    draw() {
        CTX.globalCompositeOperation = "lighter";
        CTX.shadowBlur = 20;
        CTX.shadowColor = this.color;
        CTX.fillStyle = this.color;
        CTX.fillRect(this.pos.x, this.pos.y, this.size, this.size);
        CTX.globalCompositeOperation = "source-over";
        CTX.shadowBlur = 0;
    }
}

// PARTICLES (FIXÉ)
class Particle {
    constructor(pos, color, size, vel) {
        this.pos = pos;
        this.color = color;
        this.size = Math.abs(size / 2);
        this.vel = vel;
        this.ttl = 0;
        this.gravity = -0.2;
    }

    draw() {
        CTX.fillStyle = this.color;
        CTX.fillRect(this.pos.x, this.pos.y, this.size, this.size);
    }

    update() {
        this.draw();
        this.size -= 0.3;
        this.pos.add(this.vel);
        this.vel.y -= this.gravity;
    }
}

// SCORE
function incrementScore() {
    score++;
    dom_score.innerText = score.toString().padStart(2, "0");
}

// SPLASH
function particleSplash() {
    for (let i = 0; i < splashingParticleCount; i++) {
        let vel = new helpers.Vec(Math.random() * 6 - 3, Math.random() * 6 - 3);
        let position = new helpers.Vec(food.pos.x, food.pos.y);

        particles.push(new Particle(position, currentHue, food.size, vel));
    }
}

// CLEAR
function clear() {
    CTX.clearRect(0, 0, width, height);
}

// INIT
function initialize() {
    CTX.imageSmoothingEnabled = false;
    KEY.listen();
    cellsCount = cells * cells;
    cellSize = width / cells;
    snake = new Snake();
    food = new Food();
    dom_replay.addEventListener("click", reset, false);
    loop();
}

// LOOP
function loop() {
    clear();

    if (!isGameOver) {
        requestID = setTimeout(loop, 1000 / 60);
        helpers.drawGrid();
        snake.update();
        food.draw();
        particles.forEach((p) => p.update());
        helpers.garbageCollector();
    } else {
        clear();
        gameOver();
    }
}

// GAME OVER
function gameOver() {
    CTX.fillStyle = "#4cffd7";
    CTX.textAlign = "center";
    CTX.font = "bold 30px Poppins";
    CTX.fillText("VOUS AVEZ PERDU !", width / 2, height / 2);
    CTX.font = "15px Poppins";
    CTX.fillText(`SCORE : ${score}`, width / 2, height / 2 + 60);

    maxScore ? null : (maxScore = score);
    if (score > maxScore) maxScore = score;
    window.localStorage.setItem("maxScore", maxScore);

    CTX.fillText(`MEILLEUR SCORE : ${maxScore}`, width / 2, height / 2 + 80);

    addHighScore({ name: nameOfPlayer.value, score });

    setTimeout(() => {
        document.querySelector(".wrapper").classList.add("hidden");
        showLeaderBoard();
    }, 3000);
}

// RESET
function reset() {
    dom_score.innerText = "00";
    score = 0;
    snake = new Snake();
    food.spawn();
    KEY.resetState();
    isGameOver = false;
    clearTimeout(requestID);
    loop();
}

// HIGH SCORES
function getHighScores() {
    const highScoresString = localStorage.getItem("highScores");
    return highScoresString ? JSON.parse(highScoresString) : [];
}

function saveHighScores(scores) {
    localStorage.setItem("highScores", JSON.stringify(scores));
}

function addHighScore(newScore) {
    let highScores = getHighScores();
    highScores.push(newScore);

    highScores.sort((a, b) => b.score - a.score);
    highScores = highScores.slice(0, 10);

    saveHighScores(highScores);

    console.log(highScores);
}

// LEADERBOARD
function showLeaderBoard() {
    const board = document.getElementById("leaderboard");
    const replayButton = document.getElementById("lb-replay");
    board.classList.remove("hidden");

    let highScores = getHighScores();


    const playerRankingList = document.createElement("ul");
    highScores.forEach((player, index) => {
        const playerRankingListItem = document.createElement("li");
        playerRankingListItem.textContent = `${index + 1}. ${player.name} — ${player.score}`;
        playerRankingList.appendChild(playerRankingListItem);
    });

    board.appendChild(playerRankingList);
    board.appendChild(replayButton);

    replayButton.addEventListener("click", () => {
        reset();
        board.classList.add("hidden");
        document.querySelector(".wrapper").classList.remove("hidden");
    });

}

initialize();
