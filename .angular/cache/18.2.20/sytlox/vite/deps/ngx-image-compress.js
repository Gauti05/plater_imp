import {
  CommonModule,
  NgIf
} from "./chunk-DX33AP64.js";
import {
  Component,
  EventEmitter,
  Injectable,
  NgModule,
  Output,
  RendererFactory2,
  ViewChild,
  setClassMetadata,
  ɵɵadvance,
  ɵɵdefineComponent,
  ɵɵdefineInjectable,
  ɵɵdefineInjector,
  ɵɵdefineNgModule,
  ɵɵelement,
  ɵɵelementEnd,
  ɵɵelementStart,
  ɵɵgetCurrentView,
  ɵɵinject,
  ɵɵlistener,
  ɵɵloadQuery,
  ɵɵnextContext,
  ɵɵprojection,
  ɵɵprojectionDef,
  ɵɵproperty,
  ɵɵqueryRefresh,
  ɵɵresetView,
  ɵɵrestoreView,
  ɵɵtemplate,
  ɵɵviewQuery
} from "./chunk-L4QEVNFV.js";
import "./chunk-BRF755KY.js";
import "./chunk-OKKFPXIG.js";
import "./chunk-BJIUIRBV.js";
import "./chunk-IYEYSCYL.js";
import {
  __async,
  __spreadProps,
  __spreadValues
} from "./chunk-TWWAJFRB.js";

// node_modules/ngx-image-compress/fesm2022/ngx-image-compress.mjs
var _c0 = ["video"];
var _c1 = [[["", "openStreamBtn", ""]], [["", "acquireImageBtn", ""]]];
var _c2 = ["[openStreamBtn]", "[acquireImageBtn]"];
function NgxImageCaptureComponent_span_0_Template(rf, ctx) {
  if (rf & 1) {
    const _r1 = ɵɵgetCurrentView();
    ɵɵelementStart(0, "span", 3);
    ɵɵlistener("click", function NgxImageCaptureComponent_span_0_Template_span_click_0_listener() {
      ɵɵrestoreView(_r1);
      const ctx_r1 = ɵɵnextContext();
      return ɵɵresetView(ctx_r1.startVideoCapture());
    });
    ɵɵprojection(1);
    ɵɵelementEnd();
  }
}
function NgxImageCaptureComponent_span_1_Template(rf, ctx) {
  if (rf & 1) {
    const _r3 = ɵɵgetCurrentView();
    ɵɵelementStart(0, "span", 3);
    ɵɵlistener("click", function NgxImageCaptureComponent_span_1_Template_span_click_0_listener() {
      ɵɵrestoreView(_r3);
      const ctx_r1 = ɵɵnextContext();
      return ɵɵresetView(ctx_r1.acquireImage());
    });
    ɵɵprojection(1, 1);
    ɵɵelementEnd();
  }
}
function NgxImageCaptureComponent_video_2_Template(rf, ctx) {
  if (rf & 1) {
    ɵɵelement(0, "video", 4, 0);
  }
}
var DOC_ORIENTATION;
(function(DOC_ORIENTATION2) {
  DOC_ORIENTATION2[DOC_ORIENTATION2["Up"] = 1] = "Up";
  DOC_ORIENTATION2[DOC_ORIENTATION2["Down"] = 3] = "Down";
  DOC_ORIENTATION2[DOC_ORIENTATION2["Right"] = 6] = "Right";
  DOC_ORIENTATION2[DOC_ORIENTATION2["Left"] = 8] = "Left";
  DOC_ORIENTATION2[DOC_ORIENTATION2["UpMirrored"] = 2] = "UpMirrored";
  DOC_ORIENTATION2[DOC_ORIENTATION2["DownMirrored"] = 4] = "DownMirrored";
  DOC_ORIENTATION2[DOC_ORIENTATION2["LeftMirrored"] = 5] = "LeftMirrored";
  DOC_ORIENTATION2[DOC_ORIENTATION2["RightMirrored"] = 7] = "RightMirrored";
  DOC_ORIENTATION2[DOC_ORIENTATION2["Default"] = 0] = "Default";
  DOC_ORIENTATION2[DOC_ORIENTATION2["NotJpeg"] = -1] = "NotJpeg";
  DOC_ORIENTATION2[DOC_ORIENTATION2["NotDefined"] = -2] = "NotDefined";
})(DOC_ORIENTATION || (DOC_ORIENTATION = {}));
var ImageCompress = class {
  constructor() {
    this.byteCount = (imgString) => encodeURI(imgString).split(/%..|./).length - 1;
  }
  getOrientation(file) {
    return new Promise((resolve, reject) => {
      try {
        const reader = new FileReader();
        reader.onload = () => {
          const view = new DataView(reader.result);
          if (!view.byteLength) {
            return resolve(DOC_ORIENTATION.NotDefined);
          }
          if (view.getUint16(0, false) !== 65496) {
            return resolve(DOC_ORIENTATION.NotDefined);
          }
          const length = view.byteLength;
          let offset = 2;
          while (offset < length) {
            const marker = view.getUint16(offset, false);
            offset += 2;
            if (marker === 65505) {
              if (view.getUint32(offset += 2, false) !== 1165519206) {
                return resolve(DOC_ORIENTATION.NotJpeg);
              }
              const little = view.getUint16(offset += 6, false) === 18761;
              offset += view.getUint32(offset + 4, little);
              const tags = view.getUint16(offset, little);
              offset += 2;
              for (let i = 0; i < tags; i++) {
                if (view.getUint16(offset + i * 12, little) === 274) {
                  return resolve(view.getUint16(offset + i * 12 + 8, little));
                }
              }
            } else if ((marker & 65280) !== 65280) {
              break;
            } else {
              offset += view.getUint16(offset, false);
            }
          }
          return resolve(DOC_ORIENTATION.NotJpeg);
        };
        reader.readAsArrayBuffer(file);
      } catch (e) {
        return reject(DOC_ORIENTATION.Default);
      }
    });
  }
  uploadFile(render, multiple = true, rejectOnCancel = false) {
    return new Promise((resolve, reject) => {
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      const isIOS = /iPad|iPhone|iPod/i.test(navigator.userAgent);
      Promise.resolve(isSafari || isIOS).then((onlyNative) => {
        if (onlyNative) {
          return this.generateUploadInputNative(window.document, multiple, rejectOnCancel);
        } else {
          return this.generateUploadInputRenderer(render, multiple, rejectOnCancel);
        }
      }).then((filesList) => {
        const files = filesList ? Array.from(filesList) : [];
        const orientationPromises = files.map((file) => this.getOrientation(file));
        const readerPromises = files.map((file) => this.fileToDataURL(file));
        let orientationsResult = [];
        Promise.all(orientationPromises).then((orientations) => {
          orientationsResult = orientations;
          return Promise.all(readerPromises);
        }).then((readerResult) => {
          const resultArray = readerResult.map((parsedFile, index) => ({
            image: parsedFile.dataUrl,
            orientation: orientationsResult[index],
            fileName: parsedFile.fileName
          }));
          if (multiple) {
            resolve(resultArray);
          } else {
            resolve(resultArray[0]);
          }
        });
      }).catch((err) => reject(err));
    });
  }
  fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve({
          dataUrl: e.target.result,
          fileName: file.name
        });
      };
      try {
        reader.readAsDataURL(file);
      } catch (e) {
        reject(`ngx-image-compress - probably no file have been selected: ${e}`);
      }
    });
  }
  generateUploadInputRenderer(render, multiple = true, rejectOnCancel = false) {
    let lock = false;
    return new Promise((resolve, reject) => {
      const inputElement = render.createElement("input");
      render.setStyle(inputElement, "display", "none");
      render.setProperty(inputElement, "type", "file");
      render.setProperty(inputElement, "accept", "image/*, .heic");
      if (multiple) {
        render.setProperty(inputElement, "multiple", "true");
      }
      render.listen(inputElement, "click", ($event) => {
        $event.target.value = "";
      });
      render.listen(inputElement, "change", ($event) => {
        lock = true;
        const files = $event.target.files;
        resolve(files);
      });
      if (rejectOnCancel) {
        window.addEventListener("focus", () => {
          setTimeout(() => {
            if (!lock) {
              reject(new Error("file upload on blur - no file selected"));
            }
          }, 300);
        }, {
          once: true
        });
      }
      inputElement.click();
    });
  }
  generateUploadInputNative(documentNativeApi, multiple = true, rejectOnCancel = false) {
    let lock = false;
    return new Promise((resolve, reject) => {
      const inputElement = documentNativeApi.createElement("input");
      inputElement.id = "upload-input" + /* @__PURE__ */ new Date();
      inputElement.style.display = "none";
      inputElement.setAttribute("type", "file");
      inputElement.setAttribute("accept", "image/*, .heic");
      if (multiple) {
        inputElement.setAttribute("multiple", "true");
      }
      documentNativeApi.body.appendChild(inputElement);
      inputElement.addEventListener("change", () => {
        lock = true;
        resolve(inputElement.files);
        documentNativeApi.body.removeChild(documentNativeApi.getElementById(inputElement.id));
      }, {
        once: true
      });
      if (rejectOnCancel) {
        window.addEventListener("focus", () => {
          setTimeout(() => {
            if (!lock && documentNativeApi.getElementById(inputElement.id)) {
              reject(new Error("file upload on blur - no file selected"));
              documentNativeApi.body.removeChild(documentNativeApi.getElementById(inputElement.id));
            }
          }, 300);
        }, {
          once: true
        });
      }
      inputElement.click();
    });
  }
  compress(imageDataUrlSource, orientation, render, ratio = 50, quality = 50, maxwidth = 0, maxheight = 0) {
    return new Promise(function(resolve, reject) {
      quality = quality / 100;
      ratio = ratio / 100;
      const sourceImage = new Image();
      sourceImage.onload = () => {
        const canvas = render.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return reject(`No canvas context available`);
        }
        let w = sourceImage.naturalWidth;
        let h = sourceImage.naturalHeight;
        if (!CSS.supports("image-orientation", "from-image")) {
          if (orientation === DOC_ORIENTATION.Right || orientation === DOC_ORIENTATION.Left) {
            const t = w;
            w = h;
            h = t;
          }
        }
        const xratio = maxwidth ? maxwidth / w : 1;
        const yratio = maxheight ? maxheight / h : 1;
        ratio = Math.min(ratio, xratio, yratio);
        canvas.width = w * ratio;
        canvas.height = h * ratio;
        const TO_RADIANS = Math.PI / 180;
        if (CSS.supports("image-orientation", "from-image") || orientation === DOC_ORIENTATION.Up) {
          ctx.drawImage(sourceImage, 0, 0, canvas.width, canvas.height);
        } else if (orientation === DOC_ORIENTATION.Right) {
          ctx.save();
          ctx.rotate(90 * TO_RADIANS);
          ctx.translate(0, -canvas.width);
          ctx.drawImage(sourceImage, 0, 0, canvas.height, canvas.width);
          ctx.restore();
        } else if (orientation === DOC_ORIENTATION.Left) {
          ctx.save();
          ctx.rotate(-90 * TO_RADIANS);
          ctx.translate(-canvas.width, 0);
          ctx.drawImage(sourceImage, 0, 0, canvas.height, canvas.width);
          ctx.restore();
        } else if (orientation === DOC_ORIENTATION.Down) {
          ctx.save();
          ctx.rotate(180 * TO_RADIANS);
          ctx.translate(-canvas.width, -canvas.height);
          ctx.drawImage(sourceImage, 0, 0, canvas.width, canvas.height);
          ctx.restore();
        } else {
          ctx.drawImage(sourceImage, 0, 0, canvas.width, canvas.height);
        }
        const mime = imageDataUrlSource.substr(5, imageDataUrlSource.split(";")[0].length - 5);
        const result = canvas.toDataURL(mime, quality);
        resolve(result);
      };
      sourceImage.onerror = (e) => reject(e);
      sourceImage.src = imageDataUrlSource;
    });
  }
  uploadGetImageMaxSize(maxSizeMb, debugMode, render, rejectOnCancel = false) {
    return __async(this, null, function* () {
      if (debugMode) {
        console.debug("Ngxthis - Opening upload window");
      }
      const myFile = yield this.uploadFile(render, false, rejectOnCancel);
      return yield this.getImageMaxSize(myFile, maxSizeMb, debugMode, render);
    });
  }
  getImageMaxSize(myFile, maxSizeMb, debugMode, render) {
    return __async(this, null, function* () {
      const MAX_TRIES = 10;
      const bytesToMB = (bytes) => (bytes / 1024 / 1024).toFixed(2);
      if (debugMode) {
        console.debug("Ngxthis - Opening upload window");
      }
      let compressedFile;
      for (let i = 0; i < MAX_TRIES; i++) {
        const previousSize = this.byteCount(myFile.image);
        compressedFile = yield this.compress(myFile.image, myFile.orientation, render, 50, 100);
        const newSize = this.byteCount(compressedFile);
        console.debug("Ngxthis -", "Compression from", bytesToMB(previousSize), "MB to", bytesToMB(newSize), "MB");
        if (newSize >= previousSize) {
          if (i === 0) {
            if (debugMode) {
              console.debug("Ngxthis -", "File can't be reduced at all - returning the original", bytesToMB(previousSize), "MB large");
            }
            throw __spreadProps(__spreadValues({}, myFile), {
              image: compressedFile
            });
          } else {
            if (debugMode) {
              console.debug("Ngxthis -", "File can't be reduced more - returning the best we can, which is ", bytesToMB(previousSize), "MB large");
            }
            throw __spreadProps(__spreadValues({}, myFile), {
              image: compressedFile
            });
          }
        } else {
          if (newSize < maxSizeMb * 1024 * 1024) {
            if (debugMode) {
              console.debug("Ngxthis -", "Here your file", bytesToMB(newSize), "MB large");
            }
            return __spreadProps(__spreadValues({}, myFile), {
              image: compressedFile
            });
          } else if (i === 9) {
            if (debugMode) {
              console.debug("Ngxthis -", "File can't reach the desired size after", MAX_TRIES, "tries. Returning file ", bytesToMB(previousSize), "MB large");
            }
            throw __spreadProps(__spreadValues({}, myFile), {
              image: compressedFile
            });
          }
        }
        if (debugMode) {
          console.debug("Ngxthis -", "Reached", bytesToMB(newSize), "MB large. Trying another time after", i + 1, "times");
        }
        myFile.image = compressedFile;
      }
      if (debugMode) {
        console.debug("Ngxthis - Unexpected error");
      }
      throw {};
    });
  }
};
var NgxImageCompressService = class _NgxImageCompressService {
  constructor(rendererFactory) {
    this.DOC_ORIENTATION = DOC_ORIENTATION;
    this.render = rendererFactory.createRenderer(null, null);
    this.imageCompress = new ImageCompress();
  }
  /**
   * helper to evaluate the compression rate
   * @param imgString the image in base64 string format
   */
  byteCount(image) {
    return this.imageCompress.byteCount(image);
  }
  /**
   * Get the correct Orientation value from image tags
   */
  getOrientation(file) {
    return this.imageCompress.getOrientation(file);
  }
  /**
   * return a promise with the new image data and image orientation
   * Nothing happen if no file have been selected
   */
  uploadFile() {
    return this.imageCompress.uploadFile(this.render, false);
  }
  /**
   * return a promise with an array of image data and image orientation
   * Nothing happen if no files have been selected
   */
  uploadMultipleFiles() {
    return this.imageCompress.uploadFile(this.render, true);
  }
  /**
   * return a promise with the new image data and image orientation
   * the promise will reject if no file have been selected
   */
  uploadFileOrReject() {
    return this.imageCompress.uploadFile(this.render, false, true);
  }
  /**
   * return a promise with an array of image data and image orientation
   * the promise will reject if no files have been selected
   */
  uploadMultipleFilesOrReject() {
    return this.imageCompress.uploadFile(this.render, true, true);
  }
  /**
  * perform a compression from the given DataUrl (string), provided by the uploadFile, or uploadMultipleFiles method
  *
  *
  | Parameter   | Type   | Description                                                                       |
  | ----------- | ------ | --------------------------------------------------------------------------------- |
  | image       | string | DataUrl (string) representing the image                                           |
  | orientation | number | EXIF Orientation value using the DOC_ORIENTATION enum value                       |
  | ratio       | number | Maximum scale factor as a percentage (optional, default: 50) <sup>[1](#fn1)</sup> |
  | quality     | number | JPEG quality factor as a percentage (optional, default: 50) <sup>[2](#fn2)</sup>  |
  | maxwidth    | number | Maximum width in pixels if you need to resize (optional, default: 0 - no resize)  |
  | maxheight   | number | Maximum height in pixels if you need to resize (optional, default: 0 - no resize) |
  */
  compressFile(image, orientation, ratio = 50, quality = 50, maxWidth = 0, maxHeight = 0) {
    return this.imageCompress.compress(image, orientation, this.render, ratio, quality, maxWidth, maxHeight);
  }
  /**
   * Most simple function to use here.
   * Perform an upload and return an image dataUrl (string format) with a maximum size, given in *MegaBytes*
   * If the size can't be reached, the best that can be reached will be returned in promise *rejection*
   * Put debugMode to true if you have some trouble to print some help using console.debug
   */
  uploadAndGetImageWithMaxSize(maxSizeMb = 1, debugMode = false, rejectOnCancel = false) {
    return this.imageCompress.uploadGetImageMaxSize(maxSizeMb, debugMode, this.render, rejectOnCancel).then((uploadResponse) => uploadResponse.image).catch((e) => {
      throw e.image;
    });
  }
  /**
   * Same as before, but return more informations (file name...)
   */
  uploadAndGetImageWithMaxSizeAndMetas(maxSizeMb = 1, debugMode = false, rejectOnCancel = false) {
    return this.imageCompress.uploadGetImageMaxSize(maxSizeMb, debugMode, this.render, rejectOnCancel);
  }
  /**
   * Not handling the upload, you need to provide the file and the orientation by yourself
   */
  getImageWithMaxSizeAndMetas(file, maxSizeMb = 1, debugMode = false) {
    return this.imageCompress.getImageMaxSize(file, maxSizeMb, debugMode, this.render);
  }
  static {
    this.ɵfac = function NgxImageCompressService_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _NgxImageCompressService)(ɵɵinject(RendererFactory2));
    };
  }
  static {
    this.ɵprov = ɵɵdefineInjectable({
      token: _NgxImageCompressService,
      factory: _NgxImageCompressService.ɵfac,
      providedIn: "root"
    });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(NgxImageCompressService, [{
    type: Injectable,
    args: [{
      providedIn: "root"
    }]
  }], () => [{
    type: RendererFactory2
  }], null);
})();
var NgxImageCaptureComponent = class _NgxImageCaptureComponent {
  constructor() {
    this.imageCaptured = new EventEmitter();
    this.errorCapture = new EventEmitter();
    this.videoElement = null;
    this.videoStream = ViewChild("video", {
      static: false
    });
    this.streamOpened = false;
  }
  startVideoCapture() {
    this.streamOpened = true;
    const constraints = {
      audio: false,
      video: {
        width: {
          ideal: 1920
        },
        height: {
          ideal: 1080
        },
        facingMode: {
          ideal: "user"
        }
      }
    };
    navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
      this.videoStream = stream;
      setTimeout(() => {
        if (this.videoElement && this.videoElement.nativeElement) {
          this.videoElement.nativeElement.srcObject = stream;
        }
      }, 100);
    }).catch((error) => {
      this.errorCapture.emit(`Ngx Image Compress: Could not access the camera. ${error}`);
      this.streamOpened = true;
    });
  }
  acquireImage() {
    const canvas = document.createElement("canvas");
    const video = this.videoElement && this.videoElement.nativeElement;
    if (!video) {
      this.errorCapture.emit("Ngx Image Compress - Error in acquisition of video element.");
      this.streamOpened = false;
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context2d = canvas.getContext("2d");
    if (context2d) context2d.drawImage(video, 0, 0);
    const newImage = canvas.toDataURL("jpg", 95);
    if (this.videoStream) {
      this.videoStream.getVideoTracks().forEach((track) => track.stop());
    }
    this.imageCaptured.emit(newImage);
    this.streamOpened = false;
  }
  static {
    this.ɵfac = function NgxImageCaptureComponent_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _NgxImageCaptureComponent)();
    };
  }
  static {
    this.ɵcmp = ɵɵdefineComponent({
      type: _NgxImageCaptureComponent,
      selectors: [["ngx-image-capture"]],
      viewQuery: function NgxImageCaptureComponent_Query(rf, ctx) {
        if (rf & 1) {
          ɵɵviewQuery(_c0, 5);
        }
        if (rf & 2) {
          let _t;
          ɵɵqueryRefresh(_t = ɵɵloadQuery()) && (ctx.videoElement = _t.first);
        }
      },
      outputs: {
        imageCaptured: "imageCaptured",
        errorCapture: "errorCapture"
      },
      ngContentSelectors: _c2,
      decls: 3,
      vars: 3,
      consts: [["video", ""], [3, "click", 4, "ngIf"], ["autoplay", "", 4, "ngIf"], [3, "click"], ["autoplay", ""]],
      template: function NgxImageCaptureComponent_Template(rf, ctx) {
        if (rf & 1) {
          ɵɵprojectionDef(_c1);
          ɵɵtemplate(0, NgxImageCaptureComponent_span_0_Template, 2, 0, "span", 1)(1, NgxImageCaptureComponent_span_1_Template, 2, 0, "span", 1)(2, NgxImageCaptureComponent_video_2_Template, 2, 0, "video", 2);
        }
        if (rf & 2) {
          ɵɵproperty("ngIf", !ctx.streamOpened);
          ɵɵadvance();
          ɵɵproperty("ngIf", ctx.streamOpened);
          ɵɵadvance();
          ɵɵproperty("ngIf", ctx.streamOpened);
        }
      },
      dependencies: [NgIf],
      encapsulation: 2
    });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(NgxImageCaptureComponent, [{
    type: Component,
    args: [{
      selector: "ngx-image-capture",
      template: `
        <span (click)="startVideoCapture()" *ngIf="!streamOpened">
            <ng-content select="[openStreamBtn]"></ng-content>
        </span>
        <span (click)="acquireImage()" *ngIf="streamOpened">
            <ng-content select="[acquireImageBtn]"></ng-content>
        </span>
        <video #video autoplay *ngIf="streamOpened"></video>
    `
    }]
  }], null, {
    imageCaptured: [{
      type: Output
    }],
    errorCapture: [{
      type: Output
    }],
    videoElement: [{
      type: ViewChild,
      args: ["video", {
        static: false
      }]
    }]
  });
})();
var NgxImageCaptureModule = class _NgxImageCaptureModule {
  static {
    this.ɵfac = function NgxImageCaptureModule_Factory(__ngFactoryType__) {
      return new (__ngFactoryType__ || _NgxImageCaptureModule)();
    };
  }
  static {
    this.ɵmod = ɵɵdefineNgModule({
      type: _NgxImageCaptureModule,
      declarations: [NgxImageCaptureComponent],
      imports: [CommonModule],
      exports: [NgxImageCaptureComponent]
    });
  }
  static {
    this.ɵinj = ɵɵdefineInjector({
      imports: [CommonModule]
    });
  }
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(NgxImageCaptureModule, [{
    type: NgModule,
    args: [{
      declarations: [NgxImageCaptureComponent],
      imports: [CommonModule],
      exports: [NgxImageCaptureComponent]
    }]
  }], null, null);
})();
export {
  DOC_ORIENTATION,
  NgxImageCaptureComponent,
  NgxImageCaptureModule,
  NgxImageCompressService
};
//# sourceMappingURL=ngx-image-compress.js.map
