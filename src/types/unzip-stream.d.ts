declare module 'unzip-stream' {
  import { Transform, TransformOptions } from 'stream';

  const Parse : (opts? : TransformOptions) => Transform;
  const Extract : () => void;

  export {
    Parse,
    Extract,
  };
}