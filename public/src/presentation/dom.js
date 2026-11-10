/** Mini helper para montar DOM sem innerHTML: h('div', { class: 'x' }, filhos). */
export function h(tag, props = {}, ...children) {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(props ?? {})) applyProp(element, name, value);
  appendChildren(element, children);
  return element;
}

function applyProp(element, name, value) {
  if (value === undefined || value === null || value === false) return;
  if (name === 'class') element.className = value;
  else if (name === 'value') element.value = value;
  else if (name.startsWith('on')) element.addEventListener(name.slice(2).toLowerCase(), value);
  else element.setAttribute(name, value === true ? '' : value);
}

function appendChildren(parent, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}
