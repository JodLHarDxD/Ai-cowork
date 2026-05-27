/**
 * React 18 doesn't include `inert` in HTMLAttributes.
 * React 19 adds it natively. This augments the types so we can
 * write `inert={true}` and React correctly sets/removes the attribute.
 */
import "react";

declare module "react" {
  interface HTMLAttributes<T> {
    inert?: boolean | undefined;
  }
}
