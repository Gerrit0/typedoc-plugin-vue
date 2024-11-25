# typedoc-plugin-vue

Improves display of Vue `defineComponent` variables and Pinia stores in TypeDoc documentation.

## Usage

```bash
npm install --save-dev typedoc-plugin-vue
```

```jsonc
// typedoc.json
{
    "plugin": ["typedoc-plugin-vue"],
}
```

See [an example](https://gerritbirkeland.com/typedoc-plugin-vue/classes/HelloWorld.html) of this plugin in action.

## Change Log

v1.3.0 (2024-10-24)

-   Support TypeDoc 0.27

v1.2.0 (2024-06-22)

-   Support TypeDoc 0.26.
-   Remove `$id` properties from store function declarations.

v1.1.0 (2023-10-06)

-   Added keywords so plugin will appear on TypeDoc's site, improved build process.

v1.0.0 (2023-10-06)

-   Initial release
