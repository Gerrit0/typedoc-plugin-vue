import { defineComponent, FunctionalComponent, h } from "vue";
import { defineStore } from "pinia";

// Copied from https://pinia.vuejs.org/core-concepts/#Option-Stores
export const useCounterStore = defineStore("counter", {
    state: () => ({ count: 0, name: "Eduardo" }),
    getters: {
        doubleCount: (state) => state.count * 2,
    },
    actions: {
        /** Inc docs */
        increment() {
            this.count++;
        },
    },
});

/**
 * Custom vue component defined with `defineComponent`
 */
export const HelloWorld = defineComponent({
    props: {
        /** Docs on name */
        name: { type: String, default: "world", required: true },
        /** Whether to greet the user excitedly */
        excited: Boolean,
    },

    computed: {
        /**
         * Docs on greeting
         */
        greeting() {
            return `Hello ${this.name}${this.excited ? "!" : ""}`;
        },
    },

    data() {
        return {
            color: "green",
            counterStore: useCounterStore(),
        };
    },

    methods: {
        setColor(color: string) {
            this.color = color;
        },
    },

    render() {
        return h("h1", { style: `color:${this.color}` }, this.greeting);
    },
});

interface HelloWorldProps {
    name: string;
}

type HelloWorldEvents = Array<"helloEvent">;

export const HelloWorldFunctionalComponent: FunctionalComponent<
    HelloWorldProps,
    HelloWorldEvents
> = (props: HelloWorldProps, ctx) => {
    return h("div");
};
