// Définition des différentes variables
let dom_replay = document.querySelector("#replay");
let dom_score = document.querySelector("#score");
let dom_canvas = document.createElement("canvas");
document.querySelector("#gameCanvas").appendChild(dom_canvas);
let CTX = dom_canvas.getContext("2d");

const W = (dom_canvas.width = 400); // Largeur de la grille
const H = (dom_canvas.height = 400); // Hauteur de la grille

let snake,
food,
currentHue,
cells = 20,
cellSize,
isGameOver = false,
tails = [],
score = 0,
maxScore = window.localStorage.getItem("maxScore") ||  undefined,
particles = [],
splashingParticlesCount = 20,
cellsCount,
requestID;

// Mini-moteur de fonctions utilitaires
let helpers = {
    Vec: class {
        constructor (x, y) {
            this.x = x;
            this.y = y;
        }
        // .add(v) - ajoute un déplacement au vecteur ce qui permet d'avancer
        add(v) {
            this.x += v.x;
            this.y += v.y;
            return this;
        }
        // .mult(v) - multiplie le vecteur soit par un vecteur, soit par un nombre
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
    // Utilisé pour savoir si le serpent touche la nourriture ou lui-meme
    isCollision (v1, v2) {
        return v1.x == v2.x && v1.y == v2.y;
    },
    garbageCollector () {
        for (let i = 0; i < particles.length; i++) {
            if (particles[i].size <= 0) {
                particles.splice(i, 1);
            }
        }
    },
    // Fonction pour styliser la grille du jeu : lignes verticales + horizontales
    drawGrid () {
        CTX.lineWidth = 1.1;
        CTX.strokeStyle = "#232332";
        CTX.shadowBlur = 0;
        for (let i = 0; i < cells; i++) {
            let f = (W / cells) * i;
            CTX.beginPath();
            CTX.moveTo(f, 0);
            CTX.lineTo(f, H);
            CTX.stroke();
            CTX.beginPath();
            CTX.moveTo(0, f);
            CTX.lineTo(W, f);
            CTX.stroke();
            CTX.closePath();
        }
    },
    randHue () {
        return ~~(Math.random() * 360);
    },
    hsl2rgb (hue, saturation, lightness) {
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
        } else if (huePrime === 2) {
            red = 0;
            green = chroma;
            blue = secondComponent;
        } else if (huePrime === 3) {
            red = 0;
            green = secondComponent;
            blue = chroma;
        } else if (huePrime === 4) {
            red = secondComponent;
            green = 0;
            blue = chroma;
        } else if (huePrime === 5) {
            red = chroma;
            green = chroma;
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
    lerp(start, end, t) {
        return start * (1 - t) + end * t;
    }
};

// Gérer le mouvement du joueur grace aux flèches sur le clavier
let KEY = {
    ArrowUp : false,
    ArrowRight: false,
    ArrowDown: false,
    ArrowLeft: false,
    resetState () {
        this.ArrowUp = false;
        this.ArrowRight = false;
        this.ArrowDown = false;
        this.ArrowLeft = false;
    },
    listen () {
        addEventListener(
            "keydown",
            (e) => {
                if (e.key === "ArrowUp" && this.ArrowDown) return;
                if (e.key === "ArrowDown" && this.ArrowUp) return;
                if (e.key === "ArrowLeft" && this.ArrowRight) return;
                if (e.key === "ArrowRight" && this.ArrowLeft) return;
                this[e.key] = true;
                Object.keys (this)
                .filter((f) => f !== e.key && f!== "listen" && f !== "resetState")
                .forEach((k) => {
                    this[k] = false;
                });
            },
            false
        );
    }
};

// Dessiner le serpent
class Snake {
    constructor(i, type) {
        this.pos = new helpers.Vec(W / 2, H / 2); // position du serpent au centre
        this.dir = new helpers.Vec(0, 0); // direction actuelle du mouvement (x,y)
        this.type = type; // si l'on a d'autres serpents
        this.index = i; // s'il y a une liste de serpents
        this.delay = 5; // vitesse (frames avant déplacement)
        this.size = W / cells; // taille d'un carré
        this.color = "white"; // couleur du serpent
        this.history = []; // cases déjà parcourues
        this.total = 1; // taille du serpent
    } draw () {
        let {x, y} = this.pos;
        CTX.fillStyle = this.color;
        CTX.shadowBlur = 20;
        CTX.shadowColor = "rgba(255, 255, 255, 0.3)";
        CTX.fillRect(x, y, this.size, this.size);
        CTX.shadowBlur = 0;
        if(this.total >= 2) {
            for (let  i = 0; i < this.history.length - 1; i++) {
                let {x, y} = this.history[i];
                CTX.lineWidth = 1;
                CTX.fillStyle = "rgba(255, 255, 255, 1)";
                CTX.fillRect(x, y, this.size, this.size);
            }
        }
    }
    walls () {
        let {x, y} = this.pos;
        if (x + cellSize > W) {
            this.pos.x = 0;
        }
        if (y + cellSize > H) {
            this.pos.y = 0;
        }
        if (y < 0) {
            this.pos.y = H - cellSize;
        }
        if (x < 0) {
            this.pos.x = W - cellSize;
        }
    }
}