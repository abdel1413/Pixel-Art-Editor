var Picture = class Picture {
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
};

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
// function elt(type, props, ...children) {
//   let dom = document.createElement(type);
//   if (props) Object.assign(dom, props);
//   for (let child of children) {
//     if (typeof child != "string") dom.appendChild(child);
//     else {
//       dom.appendChild(document.createTextNode(child));
//     }
//   }
//   return dom;
// }

////
function elt(type, props, ...children) {
  let dom = document.createElement(type);
  if (props) Object.assign(dom, props);
  for (let child of children) {
    if (typeof child != "string") dom.appendChild(child);
    else dom.appendChild(document.createTextNode(child));
  }
  return dom;
}
////
//ex:
// document.body.appendChild(elt("button", {
//      onclick: () => console.log("click")
//   }, "The button"));

//create a canvas picture
//We draw each pixel as a 10-by-10 square, as determined by
//the scale constant
var scale = 10;
var PictureCanvas = class PictureCanvas {
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
};

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

var PixelEditor = class PixelEditor {
  constructor(state, config) {
    let { tools, controls, dispatch } = config;
    this.state = state;

    //The pointer handler given to PictureCanvas calls the currently
    //selected tool with the appropriate arguments and, if that returns
    //a move handler, adapts it to also receive the state.
    this.canvas = new PictureCanvas(state.picture, (pos) => {
      let tool = tools[this.state.tool];
      let onMove = tool[(pos, this.state, dispatch)];
      if (onMove) return (pos) => onMove(pos, this.state);
    });

    //All controls are constructed and stored in this.controls so that they can be
    //updated when the application state changes

    this.controls = controls.map((Control) => new Control(state, config));
    this.dom = elt(
      "div",
      {},
      this.dom.canvas,
      elt("br"),
      ...this.controls.reduce((a, c) => a.concat(" ", c.dom), [])
    );
    //note: use reduce to introduce spaces between the controls’ DOM elements
  }
  synState(state) {
    this.state = state;
    this.canvas.synState(state.picture);
    for (let ctrl of this.controls) {
      ctrl.synState(state);
    }
  }
};

//It creates a <select> element with an option for each tool and
//sets up a "change" event handler that updates the application state
//when the user selects a different tool
var ToolSelect = class ToolSelect {
  constructor(state, { tools, dispatch }) {
    this.select = elt(
      "select",
      {
        onchange: () => dispatch({ tool: this.select.value }),
      },
      Object.keys(tools).map((name) =>
        elt("option", { selected: name == state.tool }, name)
      )
    );
    this.dom = elt("label", null, "🖌 Tool: ", this.select);
  }
  synState(state) {
    this.select.value = state.tool;
  }
};

//Note:By wrapping the label text and the field in a <label> element,
//we tell the browser that the label belongs to that field so that you can,
//for example, click the label to focus the field.

var ColorSelect = class ColorSelect {
  constructor(state, { dispatch }) {
    this.input = elt("input", {
      type: "color",
      value: state.color,
      onchange: () =>
        dispatch({
          color: this.input.value,
        }),
    });
    this.dom = elt("label", null, "🎨 Color: ", this.input);
  }
  synState(state) {
    this.input.value = state.color;
  }
};

//Create a function  that immediately calls the drawPixel function but
//then returns it so that it is called again for newly touched pixels
//when the user drags or swipes over the picture.
function draw(pos, state, dispatch) {
  function drawPixel({ x, y }, state) {
    let drawn = { x, y, color: state.color };
    dispatch({ picture: state.picture.draw([drawn]) });
  }

  drawPixel(pos, state);
  return drawPixel;
}

function rectangles(start, state, dispatch) {
  function drawrectangle(pos) {
    let xStart = Math.min(start.x, pos.x);
    let yStart = Math.min(start.y, pos.y);
    let xEnd = Math.max(start.x, pos.x);
    let yEnd = Math.max(start.y, pos.y);
    let drawn = [];
    for (let y = yStart; y < yEnd; y++) {
      for (let x = xStart; x < xEnd; x++) {
        drawn.push({ x, y, color: state.color });
      }
    }
    dispatch({ picture: state.picture.draw(drawn) });
  }
  drawrectangle(start);
  return drawrectangle;
}

const around = [
  { dx: -1, dy: 0 },
  { dx: 1, dy: 0 },
  { dx: 0, dy: -1 },
  { dx: 0, dy: 1 },
];

//this code searches through a grid to find all “connected” pixels
function fill({ x, y }, state, dispatch) {
  let targetColor = state.picture.pixel(x, y);
  let drawn = [{ x, y, color: state.color }];
  for (let done = 0; done < drawn.length; done++) {
    for (let { dx, dy } of around) {
      let x = drawn[done].x + dx;
      let y = drawn[done].y + dy;
      if (
        x > 0 &&
        x < state.picture.width &&
        y > 0 &&
        y < state.picture.height &&
        state.picture.pixel(x, y) == targetColor &&
        !drawn.some((p) => p.x == x && p.y == y)
      ) {
        drawn.push({ x, y, color: state.color });
      }
    }
  }
  dispatch({ picture: state.picture.draw(drawn) });
}

//Note:For each pixel reached, we have to see whether any adjacent
//pixels have the same color and haven’t already been painted over

//a color picker, which allows you to point at a color in the picture to
//use it as the current drawing color
function pick(pos, state, dispatch) {
  dispatch({ color: state.picture.pixel(pos.x, pos.y) });
}

let state = {
  tool: "draw",
  color: "000000",
  picture: Picture.empty(60, 30, "#f0f0f0"),
};

let app = new PixelEditor(state, {
  tools: [draw, fill, rectangles, pick],
  controls: [ToolSelect, ColorSelect],
  dispatch(action) {
    state = updateSate(state, action);
    app.syncState(state);
  },
});
document.querySelector("div").appendChild(app.dom);

//create a button for downlaoding

/**
 *
 * @param {*} state
 * The component keeps track of the current picture so that
 * it can access it when saving. To create the image file,
 * it uses a <canvas> element that it draws the picture on
 * (at a scale of one pixel per pixel).
 */

var SaveButton = class SaveButton {
  constructor(state) {
    this.picture = state.picture;
    this.dom = elt(
      "button",
      {
        onclick: () => this.save(),
      },
      "💾 Save"
    );
  }
  // create a link element that points at this URL and has a download attribute
  //to get browser to download pic.We add that link to the document,
  //simulate a click on it, and remove it again.
  save() {
    let canvas = elt("canvas", DrawPicture(this.picture, canvas, 1));
    let link = elt("a", {
      href: this.canvas.toDataURL(),
      download: "pixelart.png",
    });
    document.body.appendChild(link);
    link.click();
    this.remove();
  }
  synState(state) {
    this.picture = state.picture;
  }
};

//Note:toDataURL method on a canvas element creates a URL that starts with data
//containing the whole data in the URL

var LoadButton = class LoadButton {
  constructor(_, { dispatch }) {
    this.dom = elt(
      "button",
      {
        onclick: () => this.startLoad(dispatch),
      },
      "📁 Load"
    );
  }
};
function startLoad(dispatch) {
  let input = elt("input", {
    type: "file",
    onchange: () => finishLoad(input.files[0], dispatch),
  });
  document.body.appendChild(input);
  input.onclick();
  input.remove();
}

function finishLoad(file, dispatch) {
  if (file == null) return;
  let reader = new FileReader();
  reader.addEventListener("load", () => {
    let img = elt("img", {
      onload: () =>
        dispatch({
          picture: pictureFromImage(img),
        }),
      src: reader.result,
    });
  });
  reader.readAsDataURL(file);
}

//To get access to the pixels, we first draw the picture to a
//<canvas> element. The canvas context has a getImageData method that
//allows a script to read its pixels.So, once the picture is on the canvas,
//we can access it and construct a Picture object
function pictureFromImage(image) {
  let width = Math.min(100, image.width);
  let height = Math.min(100, image.height);
  let canvas = elt("canvas", { width, height });
  let cx = canvas.getContext("2d");
  cx.drawImage(canvas, 0, 0);
  let pixels = [];
  let { data } = cx.getImageData(0, 0, width, height);

  // the hex helper function calls padStart to add a leading zero when necessary
  //n.toString(16) will produce a string representation in base 16
  function hex(n) {
    return n.toString(16).padStart(2, "0");
  }

  for (let i = 0; i < data.length; i += 4) {
    let [r, g, b] = data.slice(i, i + 3);
    pixels.push("#" + hex(r) + hex(g) + hex(b));
  }

  return new Picture(width, height, pixels);
}

function historyUpdateState(state, action) {
  if (action.undo == true) {
    if (state.done.length == 0) return state;
    return Object.assign(
      {},
      {
        picture: state.done[0],
        done: state.slice(1),
        doneAt: 0,
      }
    );
  } else if (action.picture && state.doneAt < Date.now() - 1000) {
    return Object.assign({}, state.action, {
      done: [state.picture, ...state.done],
      doneAt: Date.now(),
    });
  } else {
    return Object.assign({}, state, action);
  }
}
