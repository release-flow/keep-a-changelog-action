import { Root } from 'mdast';
import { Plugin, Processor, TransformCallback } from 'unified';
import { VFile } from 'vfile';

const attacher: Plugin<[string, Processor<undefined, Root, Root, any, any>], Root, Root> = function (
  field: string,
  processor: Processor<undefined, Root, Root, any, any>
) {
  // Copy the processor data from the input pipeline to the new pipeline
  const data = this.data();
  processor.data(data);
  return transformer;

  function transformer(tree: Root, file: VFile, next: TransformCallback<Root>) {
    processor.run(tree, file, function done(err: Error | undefined, node: Root | undefined) {
      if (node) {
        file.data[field] = processor.stringify(node);
      }
      next(err);
    });
  }
};

export default attacher;
