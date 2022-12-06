class Picture {
  constructor(width, height, pixels) {
    this.width = width;
    this.height = height;
    this.pixels = pixels;
  }

  /**
   *
   * @param {*} width
   * @param {*} height
   * @param {*} color
   * @returns
   *  create an array  constructor in which all pixels have
   * the same color using fill method
   */
  static empty(width, height, color) {
    let pixels = new Array(width * height).fill(color);
    console.log(pixels);
    return new Picture(width, height, color);
  }
  //
  pixel(x, y) {
    return this.pixels[x + y * this.width];
  }
  // draw method uses slice without arguments to copy the entire
  //  pixel array and return new Picture with overwritten pixels
  draw(pixels) {
    let copy = this.pixels.slice();
    for (let { x, y, color } of pixels) {
      copy[x + y * this.width] = color;
    }
    return new Picture(this.width, this.height, copy);
  }
}

//allow the interface to dispatch actions as objects whose properties
//overwrite the properties of the previous state.The color field,
//when the user changes it, could dispatch an object like
// { color: field.value }, from which this update function can
//compute a new state.
function updateState(state, action) {
  return Object.assign({}, state, action);
}

//Create an elt function to set properties whose value isn’t a string,
//such as onclick, which can be set to a function to register
//a click event handler.
function elt(type, props, ...children) {
  let dom = document.createElement(type);
  if (props) Object.assign(dom, props);
  for (let child of children) {
    if (typeof child != "string") dom.appendChild(child);
    else {
      dom.appendChild(document.createTextNode(child));
    }
  }
  return dom;
}
//ex:
// document.body.appendChild(elt("button", {
//      onclick: () => console.log("click")
//   }, "The button"));

//create a canvas picture
//We draw each pixel as a 10-by-10 square, as determined by
//the scale constant
const scale = 10;
class PictureCanvas {
  constructor(picture, pointerDown) {
    this.dom = elt("canvas", {
      onmousedown: (event) => this.mouse(event, pointerDown),
      ontouchstart: (event) => this.touch(event, pointerDown),
    });
    this.synState(picture);
  }

  synState(picture) {
    if (this.picture == picture) return;
    this.picture = picture;
    DrawPicture(this.picture, this.dom, scale);
  }
}

//drawing function sets the size of the canvas based
//on the scale and picture size and fills it with a series of squares,
//one for each pixel.
function DrawPicture(picture, canvas, scale) {
  canvas.width = picture.width * scale;
  canvas.height = picture.height * scale;
  let cx = canvas.getContext("2d");

  for (let y = 0; y < picture.height; y++) {
    for (let x = 0; x < picture.width; x++) {
      cx.fillStyle = picture.pixel(x, y);
      cx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
}

PictureCanvas.prototype.mouse = function (downEvent, onDown) {
  if (downEvent.button != 0) return;
  let pos = PointerPosition(downEvent, this.dom);
  let onMove = onDown(pos);
  if (!onMove) return;
  let move = (moveEvent) => {
    if (moveEvent.buttons == 0) {
      this.dom.removeEventListener("mousemove", move);
    } else {
      let newPos = PointerPosition("moveEvent", this.dom);
      if (newPos.x == pos.x && newPos.y == pos.y) return;
      pos = newPos;
      onMove(newPos);
    }
  };
  this.dom.addEventListener("mousemove", move);
};

function PointerPosition(pos, domNode) {
  let rect = domNode.getBoundingClientRect();
  return {
    x: Math.floor((pos.clientX - rect.left) / scale),
    y: Math.floor((pos.clientY - rect.top) / scale),
  };
}

PictureCanvas.prototype.touch = function (startEvent, onDown) {
  let pos = PointerPosition(startEvent.touches[0], this.dom);
  let onMove = onDown(pos);
  startEvent.preventDefault();
  if (!onMove) return;
  let move = (moveEvent) => {
    let newPos = PointerPosition(moveEvent.touches[0], this.dom);
    if (newPos.x === pos.x && newPos.y == pos.y) return;
    pos = newPos;
    onMove(newPos);
  };

  let end = () => {
    this.dom.removeEventListener("touchmove", move);
    this.dom.removeEventListener("touchend", end);
  };

  this.dom.addEventListener("touchmove", move);
  this.addEventListener("touchend", end);
};

class PixelEditor {
  constructor(state, config) {
    let { tools, controls, dispatch } = config;
    this.state = state;

    this.canvas = new PictureCanvas(state.picture, (pos) => {
      let tool = tools[this.state.tool];
      let onMove = tool[(pos, this.state, dispatch)];
      if (onMove) return (pos) => onMove(pos, this.state);
    });
    this.controls = controls.map((Control = new Control(this.state, config)));
    this.dom = elt(
      "div",
      {},
      this.dom.canvas,
      elt("br"),
      ...this.controls.reduce((a, c) => a.concat(" ", c.dom), [])
    );
  }
  synState(state) {
    this.state = state;
    this.canvas.synState(state.picture);
    for (let ctrl of this.controls) {
      ctrl.synState(state);
    }
  }
}
