import { Plugin } from 'unified';
import { Node } from 'unist';
import { VFile } from 'vfile';

function transformer(_tree: Node, file: VFile) {
  if (file.messages.some((m) => m.fatal === true)) {
    file.fail('Invalid changelog: fatal errors were detected.');
  }
}

const attacher: Plugin = function () {
  return transformer;
};

/**
 * The same check as the default export, for use a second time in a pipeline: unified ignores repeated uses of the
 * same plugin, so a distinct attacher is needed.
 */
export const reassert: Plugin = function () {
  return transformer;
};

export default attacher;
