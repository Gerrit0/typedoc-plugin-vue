import { outdent } from "outdent";
import { Application, DeclarationReflection, ProjectReflection, ReflectionKind, TSConfigReader } from "typedoc";
import { beforeAll, expect, test } from "vitest";
import { load } from "../plugin.js";

let project: ProjectReflection;

beforeAll(async () => {
    const app = await Application.bootstrap(
        {
            entryPoints: ["src/testdata/component.ts"],
        },
        [new TSConfigReader()],
    );
    load(app);

    project = (await app.convert())!;
    expect(project).toBeDefined();
});

test("Turns defineComponent objects into classes with members for methods/props/computed/data", () => {
    const HelloWorld = project.getChildByName(
        "HelloWorld",
    ) as DeclarationReflection;

    expect(HelloWorld.kind).toBe(ReflectionKind.Class);

    expect(
        HelloWorld.children
            ?.map((c) => c.name)
            .sort((a, b) => a.localeCompare(b)),
    ).toEqual([
        "color",
        "counterStore",
        "excited",
        "greeting",
        "name",
        "setColor",
    ]);
});

test("Turns FunctionalComponent objects into classes", () => {
    const HelloWorld = project.getChildByName(
        "HelloWorldFunctionalComponent",
    ) as DeclarationReflection;

    expect(HelloWorld.kind).toBe(ReflectionKind.Class);

    expect(
        HelloWorld.children
            ?.map((c) => c.name)
            .sort((a, b) => a.localeCompare(b)),
    ).toEqual(["name"]);
});

test("Adds store properties to the store function", () => {
    const typeDeclaration = project.getChildByName(
        "useCounterStore",
    ) as DeclarationReflection;
    expect(typeDeclaration.toStringHierarchy()).toBe(outdent`
        Function useCounterStore
          CallSignature useCounterStore: PiniaStore<useCounterStore>
            Parameter pinia: null | Pinia
            Parameter hot: StoreGeneric
          Property count: number
          Property doubleCount: number
          Property name: string
          Method increment
            CallSignature increment: void
    `);
});

test("Resolves references to the store instance", () => {
    const counterStore = project.getChildByName(
        "HelloWorld.counterStore",
    ) as DeclarationReflection;

    expect(counterStore.type?.toString()).toEqual(
        "PiniaStore<useCounterStore>",
    );
});
