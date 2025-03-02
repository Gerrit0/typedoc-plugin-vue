# typedoc-plugin-vue

Improves display of Vue `defineComponent` variables and Pinia stores in TypeDoc documentation.
Also attempts to recognize `FunctionalComponent` variables and convert them as classes.

## Usage

```bash
npm install --save-dev typedoc-plugin-vue
```

```jsonc
// typedoc.json
{
    "plugin": ["typedoc-plugin-vue"],
    // Defaults to true, removes $props, $watch, etc. from generated classes
    "excludeVueProperties": true
}
```

See [an example](https://gerritbirkeland.com/typedoc-plugin-vue/classes/HelloWorld.html) of this plugin in action.

## Change Log

v1.5.0 (2025-03-02)

- Added support for TypeDoc 0.28

v1.4.0 (2025-02-01)

- Added support for handling variables declared with `FunctionalComponent` as their type
- Added `excludeVueProperties` option

v1.3.0 (2024-10-24)

- Support TypeDoc 0.27

v1.2.0 (2024-06-22)

- Support TypeDoc 0.26.
- Remove `$id` properties from store function declarations.

v1.1.0 (2023-10-06)

- Added keywords so plugin will appear on TypeDoc's site, improved build process.

v1.0.0 (2023-10-06)

- Initial release
