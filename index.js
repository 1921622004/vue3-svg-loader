const { baseCompile } = require('@vue/compiler-dom');
const { getOptions } = require('loader-utils')

const SVGO = require('svgo')

const transformChildren = (value) => {
  const chilldren = value.reduce((acc, child) => {
    if (child.type === 2) {
      acc.push(`'${child.text}',`);
    } else {
      const templateStr = `
        _createVNode(
          "${child.tag}", 
          {
            ${child.props ? child.props.map((propItem) => {
        return `'${propItem.name}': "${propItem.value.content}"`;
      }).join(',\n') : ''}
          },
          ${child.children && child.children.length ? `${transformChildren(child.children)}` : 'null'}
        ),
      `;
      acc.push(templateStr);
    }
    return acc;
  }, []);

  return `[${chilldren.join()}]`;
};

const svgToVue3Comp = (content, options = {}) => {
  const {
    svgoConfig = {},
    svgoPath = null,
  } = options;

  let svg = Promise.resolve(content);

  if (svgoConfig !== false) {
    svg = new SVGO(svgoConfig)
      .optimize(content, { path: svgoPath })
      .then((result) => result.data);
  }

  return svg.then((result) => {
    const { ast } = baseCompile(result);

    const children = ast.children.length
      ? `(children || []).concat(${transformChildren(ast.children[0].children)})`
      : '(children || [])';

    return `
      import { toDisplayString as _toDisplayString, createVNode as _createVNode, openBlock as _openBlock, createBlock as _createBlock } from "vue"

      export default {
        render({ children }) {
          return (
            _openBlock(),
            _createBlock(
              "svg",
              {
                ${ast.children[0].props.length > 0 ? ast.children[0].props.map((propItem) => {
      return `'${propItem.name}': "${propItem.value.content}"`;
    }).join(',\n') : ''}
              }
              ,
              ${children}
            )
          )
        }
      }
    
    `
  });
};

module.exports = function (source) {
  const callback = this.async();
  const options = getOptions(this);
  const { svgoConfig = {} } = options

  svgToVue3Comp(source, {
    svgoPath: this.resourcePath,
    svgoConfig,
  })
    .then((component) => callback(null, component))
    .catch(callback);
};
