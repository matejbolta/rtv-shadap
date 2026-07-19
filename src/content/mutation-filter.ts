const OWNED_SELECTOR = "[data-rtv-tracker-owned='true']";

export function mutationsAreExtensionOwned(mutations: MutationRecord[]): boolean {
  return mutations.length > 0 && mutations.every(mutationIsExtensionOwned);
}

function mutationIsExtensionOwned(mutation: MutationRecord): boolean {
  if (nodeIsExtensionOwned(mutation.target)) return true;
  if (mutation.type !== "childList") return false;

  const changedNodes = [...Array.from(mutation.addedNodes), ...Array.from(mutation.removedNodes)];
  return changedNodes.length > 0 && changedNodes.every(nodeIsExtensionOwned);
}

function nodeIsExtensionOwned(node: Node): boolean {
  if (node instanceof Element) return node.matches(OWNED_SELECTOR) || Boolean(node.closest(OWNED_SELECTOR));
  return node.parentElement?.closest(OWNED_SELECTOR) != null;
}
