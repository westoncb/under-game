const THREE = require("three")
const Events = require("./events.js")
const Simulation = require("./simulation.js")
const GameStateTransformer = require("./gameStateTransformer.js")
import "./style.css"

window.onload = () => {
    if (isMobile()) {
        const container = document.getElementById("canvas-container")
        container.style.cssText = `
            position: absolute;
            left: 0;
            right: 0;
            top: 0;
            bottom: 0;
            width: 100%;
            height: 100%;
        `
        // screen.orientation.lock("landscape")
        // const videoHTML = "<div style='display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;'><iframe width='560' height='315' src='https://www.youtube.com/embed/Q010AFPItqY' frameborder='0' allow='accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture' allowfullscreen></iframe></div>";
        // container.innerHTML = videoHTML;

        // const textNode = document.createTextNode("Mobile isn't supported yet, so there's just this video.");
        // container.appendChild(textNode);
    }

    const simulation = new Simulation()
    const clock = new THREE.Clock()

    Events.enqueue("change_transformer", {
        transformer: new GameStateTransformer(),
    })

    class MainLoop {
        static update(time) {
            requestAnimationFrame(MainLoop.update)

            simulation.update(time / 1000, clock.getDelta())
            simulation.render()
        }
    }

    MainLoop.update(0)
}

const mobileRE =
    /(android|bb\d+|meego).+mobile|armv7l|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series[46]0|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/i

const tabletRE = /android|ipad|playbook|silk/i

function isMobile(opts) {
    if (!opts) opts = {}
    let ua = opts.ua
    if (!ua && typeof navigator !== "undefined") ua = navigator.userAgent
    if (ua && ua.headers && typeof ua.headers["user-agent"] === "string") {
        ua = ua.headers["user-agent"]
    }
    if (typeof ua !== "string") return false

    let result = mobileRE.test(ua) || (!!opts.tablet && tabletRE.test(ua))

    if (
        !result &&
        opts.tablet &&
        opts.featureDetect &&
        navigator &&
        navigator.maxTouchPoints > 1 &&
        ua.indexOf("Macintosh") !== -1 &&
        ua.indexOf("Safari") !== -1
    ) {
        result = true
    }

    return result
}
