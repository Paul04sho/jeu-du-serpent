// SELECTION DES ELEMENTS
let dom_replay = document.querySelector("#replay");
let dom_score = document.querySelector("#score");
let dom_canvas = document.createElement("canvas");
let userName = document.querySelector("#username");
let playButton = document.querySelector("#playBtn");
let overallGrid = document.querySelector(".wrapper");
document.querySelector("#canvas").appendChild(dom_canvas);
let CTX = dom_canvas.getContext("2d");

const width = (dom_canvas.width = 400);
const height = (dom_canvas.height = 400);
const scoresJSON = localStorage.getItem("highscores");


let nameOfPlayer = document.getElementById("username");
let startGameButton = document.getElementById("playBtn");


// CREATION DES VARIABLES DU JEU
let snake,
food,
currentHue,
cells = 20,
cellSize,
isGameOver = false,
tails = [],
score = 0,
maxScore = window.localStorage.getItem("maxScore" || undefined),
particles = [],
splashingParticleCount = 20,
cellsCount,
requestID;

// FONCTION UTILITAIRE - définir un vecteur responsable du mouvement ayant x et y pour coordonnées
let helpers = {
    Vec: class {
        constructor(x, y) {
            this.x = x;
            this.y = y;
        } add(v) {
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
    isCollision (v1, v2) {
        return v1.x == v2.x && v1.y == v2.y;
    },
    garbageCollector() {
        for (let i = 0; i < particles.length; i++) {
            if (particles[i].size <= 0) {
                particles.splice(i, 1);
            }
        }
    },
    // style des lignes de la grille (longueur, couleur, ...)
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
        return  ~~(Math.random() * 360);
    },
    hsl2rgb(hue, saturation, lightness) {
        if (hue == undefined) {
            return [0, 0, 0];
        }
        var chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
        var huePrime = hue / 60;
        var secondComponent = chroma * (1 - Math.abs((huePrime % 2) - 1));

        huePrime = ~~huePrime;
        var red;
        var green;
        var blue;

        if (huePrime === 0) {
            red = chroma;
            green = secondComponent;
            blue = 0;
        } else if (huePrime === 1) {
            red = secondComponent;
            green = chroma;
            blue = 0;
        }
        else if (huePrime === 2) {
            red = 0;
            green = chroma;
            blue = secondComponent;
        }
        else if (huePrime === 3) {
            red = 0;
            green = secondComponent;
            blue = chroma;
        }
        else if (huePrime === 4) {
            red = secondComponent;
            green = 0;
            blue = chroma;
        }
        else if (huePrime === 5) {
            red = chroma;
            green = 0;
            blue = secondComponent;
        }
        var lightnessAdjustement = lightness - chroma / 2;
        red += lightnessAdjustement;
        green += lightnessAdjustement;
        blue += lightnessAdjustement;

        return [
            Math.round(red * 255),
            Math.round(green * 255),
            Math.round(blue * 255)
        ];
    },
    // Linear Interpolation (LERP) - anime les mouvements du serpent en les rendant fluides
    lerp(start, end, t) {
        return start * (1 - t) + end * t;
    }
}

// CREATION DE LA MECANIQUE DE JEU A L'AIDE DES TOUCHES DU CLAVIER
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
                .filter((f) => f !== e.key && f !== "listen" && f !== "resetState")
                .forEach((k) => {
                    this[k] = false;
                });
            },
            false
        );
    }
};

// DESSINER LE SERPENT ET LUI APPLIQUER DES PROPRIETES
class Snake {
    constructor(i, type) {
        this.pos = new helpers.Vec(width / 2, height / 2);
        this.dir = new helpers.Vec(0, 0);
        this.type = type;
        this.index = i;
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
        CTX.shadowColor = "rgba(255, 255, 255, 0.3)";
        CTX.fillRect(x, y, this.size, this.size);
        CTX.shadowBlur = 0;
        if (this.total >= 2) {
            for (let i = 0; i < this.history.length - 1; i++) {
                let { x, y } = this.history[i];
                CTX.lineWidth = 1;
                CTX.fillStyle = "rgba(255, 255, 255, 1)";
                CTX.fillRect(x, y, this.size, this.size);
            }
        }
    }
    // pour permettre au serpent de traverser les murs
    walls() {
        let { x, y } = this.pos;
        if (x + cellSize > width) {
            this.pos.x = 0;
        } // téléporte le serpent de droite à gauche
        if (y + cellSize > width) {
            this.pos.y = 0;
        } // téléporte le serpent de gauche à droite
        if (y < 0) {
            this.pos.y = height - cellSize;
        } // téléporte le serpent de haut en bas
        if (x < 0) {
            this.pos.x = width - cellSize;
        } // téléporte le serpent de bas en haut
    }
    controlls() {
        let dir = this.size;
        if (KEY.ArrowUp) {
            this.dir = new helpers.Vec(0, -dir);
        }
        if (KEY.ArrowDown) {
            this.dir = new helpers.Vec(0, dir);
        }
        if (KEY.ArrowLeft) {
            this.dir = new helpers.Vec(-dir, 0);
        }
        if (KEY.ArrowRight) {
            this.dir = new helpers.Vec(dir, 0);
        }
    }
    selfCollision() {
        for (let i = 0; i < this.history.length; i++) {
            let p = this.history[i];
            // L'utilisateur perd le jeu dans le cas ou le serpent se cogne lui-meme
            if (helpers.isCollision(this.pos, p)) {
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
            this.total > 3 ? this.selfCollision() : null;
        }
    }
}

// DESSINER LA NOURRITURE 
class Food {
    constructor() {
        this.pos = new helpers.Vec(
            ~~(Math.random() * cells) * cellSize,
            ~~(Math.random() * cells) * cellSize
        );
        this.color = currentHue = `hsl(${~~(Math.random() * 360)},100%,50%)`;
        this.size = cellSize;
    }
    draw() {
        let { x, y } = this.pos;
        CTX.globalCompositeOperation = "lighter";
        CTX.shadowBlur = 20;
        CTX.shadowColor = this.color;
        CTX.fillStyle = this.color;
        CTX.fillRect(x, y, this.size, this.size);
        CTX.globalCompositeOperation = "source-over";
        CTX.shadowBlur = 0;
    }
    // point d'apparition de la nourriture déterminé aléatoirement
    spawn() {
        let randX = ~~(Math.random() * cells) * this.size;
        let randY =  ~~(Math.random() * cells) * this.size;
        for (let path of snake.history) {
            if (helpers.isCollision(new helpers.Vec(randX, randY), path)) {
                return this.spawn();
            }
        } // boucle Pour utilisé pour s'assurer que la position de
          // la nourriture est différente de celle du corps du serpent
        this.color = currentHue = `hsl(${helpers.randHue()}, 100%, 50%)`; 
        this.pos = new helpers.Vec(randX, randY);
    }
}

// DESSINER LES SEGMENTS DU CORPS DU SERPENT ET CELUI DE LA NOURRITURE
class Particle {
    constructor(pos, color, size, vel) {
        this.pos = pos;
        this.color = color;
        this.size = Math.abs(size / 2);
        this.ttl = 0;
        this.gravity = -0.2;
        this.vel = vel;
    }
    draw() {
        let { x, y } = this.pos;
        let hsl = this.color
        .split("")
        .fiter((l) => l.match(/[^hsl()$% ]/g))
        .join("")
        .split("")
        .map((n) => +n);
        let [r, g, b] = helpers.hsl2rgb(hsl[0], hsl[1] / 100, hsl[2] / 100);
        CTX.shadowColor = `rgb(${r},${g},${b},${1})`;
        CTX.shadowBlur = 0;
        CTX.globalCompositeOperation = "lighter";
        CTX.fillRect(x, y, this.size, this.size);
        CTX.globalCompositeOperation = "source-over";

    }
    update() {
        this.draw();
        this.size -= 0.3;
        this.ttl += 1;
        this.pos.add(this.vel);
        this.vel.y -= this.gravity;
    }
}

// FONCTION POUR INCREMENTER LE SCORE - ajouter +1 lorsque le serpent réussit à avaler la nourriture
function incrementScore() {
    score++;
    dom_score.innerText = score.toString().padStart(2, "0");
}

// FONCTION LIE AUX ANIMATIONS VISUELLES - effet confetti ou petites explosions
function particleSplash() {
    for (let i = 0; i < splashingParticleCount; i++) {
        let vel = new helpers.Vec(Math.random() * 6 - 3, Math.random() * 6 - 3);
        let position = new helpers.Vec(food.pos.x, food.pos.y);

        particles.push(new Particle(position, currentHue, food.size, vel));
    }
}

// FONCTION POUR EFFACER LE CONTENU DE LA GRILLE DE JEU
function clear() {
    CTX.clearRect(0, 0, width, height);
}

// FONCTION QUI GERE L'AFFICHAGE DE NOUVELLES PARTIES
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

// FONCTION PRINCIPALE 
function loop() {
    clear(); // appel de la fonction clear()
    if (!isGameOver) {
        requestID = setTimeout(loop, 1000 / 60) // vitesse du jeu
        helpers.drawGrid(); // dessiner la grille
        snake.update(); // mettre à jour la position du serpent
        food.draw(); // dessiner la nourriture
        for (let p of particles) {
            p.update();
        }
        helpers.garbageCollector();
    } else {
        clear();
        gameOver();
    }
}

// FONCTION GAME OVER
function gameOver() {
    const usernameValue = username.value;
    const userScore = score;
    maxScore ? null : (maxScore = score);
    score > maxScore ? (maxScore = score) : null;
    window.localStorage.setItem("maxScore", maxScore);
    CTX.fillStyle = "#4cffd7";
    CTX.textAlign = "center";
    CTX.font = "bold 30px Poppins";
    CTX.fillText("VOUS AVEZ PERDU !",  width / 2, height / 2); // afficher ce message si le joueur perd
    CTX.font = "15px Poppins"
    CTX.fillText(`SCORE : ${score}`, width / 2, height / 2 + 60);
    CTX.fillText(`MEILLEUR SCORE : ${maxScore}`, width / 2, height / 2 + 80);

    addHighScore({name: nameOfPlayer.value, score: score});

    // affichage du leaderboard après 5 secondes
    setTimeout(() => {
        document.querySelector(".wrapper").classList.add("hidden");
        showLeaderBoard();
    }, 3000);
}

// FONCTION POUR LE RELANCEMENT DES PARTIES
function reset() {
    dom_score.innerText = "00";
    score = "00";
    snake = new Snake();
    food.spawn();
    KEY.resetState();
    isGameOver = false;
    clearTimeout(requestID);
    loop();
}

// FONCTION POUR CLASSER LES SCORES
function getHighScores() {
    const highScoresString = localStorage.getItem('highScores');
    return highScoresString ? JSON.parse(highScoresString) : [];
}

function saveHighScores(scores) {
    localStorage.setItem('highScores', JSON.stringify(scores));
}

function addHighScore(newScore) {
    let highScores = getHighScores();

    highScores.push(newScore);

    highScores.sort((a, b) => b.score - a.score);
    highScores = highScores.slice(0, 10);

    saveHighScores(highScores);
}

// FONCTION POUR MONTRER LE CLASSEMENT FINAL PAR UTILISATEUR
function showLeaderBoard() {
    const board = document.getElementById("leaderboard");
    board.classList.remove("hidden");

    let highScores = getHighScores();

    board.innerHTML ="<h2>TOP 10 JOUEURS</h2>"

    const playerRankingList = document.createElement("ul");
    highScores.forEach(player => {
        const playerRankingListItem = document.createElement("li");
        playerRankingListItem.textContent = `${index + 1}. ${player.name} — ${player.score}`;
        playerRankingList.appendChild(playerRankingListItem);
    });

    board.appendChild(playerRankingList);

}

initialize();