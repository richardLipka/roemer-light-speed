/** The three lines of DOM helper this app needs, and no framework. */

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function button(className: string, label: string, onClick: () => void): HTMLButtonElement {
  const node = el('button', className, label);
  node.type = 'button';
  node.addEventListener('click', onClick);
  return node;
}

/** Replace a node's children in one go, without a stale-render race. */
export function fill(parent: HTMLElement, ...children: (Node | string)[]): void {
  parent.replaceChildren(...children);
}
