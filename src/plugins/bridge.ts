import { Plugin, Processor, TransformCallback } from 'unified';
import { Node } from 'unist';
import { VFile } from 'vfile';

const attacher: Plugin<[string, Processor<void, Node>]> = function (field: string, processor: Processor<void, Node>) {
  // Copy the processor data from the input pipeline to the new pipeline
  const data = this.data();
  processor.data(data);
  return transformer;

  function transformer(tree: Node, file: VFile, next: TransformCallback<Node>) {
    processor.run(tree, file, function done(err: Error | null | undefined, node: Node | undefined) {
      if (node) {
        file.data[field] = processor.stringify(node);
      }
      next(err);
    });
  }
};

export default attacher;
