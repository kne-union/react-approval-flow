import { register } from 'node:module';

register(
  'data:text/javascript,' +
    encodeURIComponent(`
export async function resolve(specifier, context, next) {
  if (specifier.startsWith('.') && !/\\.[cm]?js$/.test(specifier)) {
    try {
      return await next(specifier + '.js', context);
    } catch (e) {
      return next(specifier + '/index.js', context);
    }
  }
  return next(specifier, context);
}
`),
  import.meta.url
);
