import { ParameterType, Reflection } from "typedoc";
import {
    Application,
    Context,
    Converter,
    DeclarationReflection,
    ReferenceType,
    ReflectionFlag,
    ReflectionKind,
    SignatureReflection,
    TypeScript as ts,
} from "typedoc";

declare module "typedoc" {
    interface TypeDocOptionMap {
        excludeVueProperties: boolean;
    }
}

// store function symbol -> reflection id that documents it
const storeLinks = new Map<ts.Symbol, DeclarationReflection>();
// properties/variables which reference a store
const storeReferences = new Map<ts.Symbol, DeclarationReflection[]>();

const functionalComponentProperties = [
    "__file",
    "__isBuiltIn",
    "__name",
    "compatConfig",
    "displayName",
    "emits",
    "inheritAttrs",
    "props",
    "slots",
];

const functionalComponentReflections = new Set<DeclarationReflection>();

export function load(app: Application) {
    app.options.addDeclaration({
        name: "excludeVueProperties",
        help:
            "If set, Vue properties will be excluded from classes generated with defineComponent and FunctionalComponent",
        type: ParameterType.Boolean,
        defaultValue: true,
    });

    app.converter.on(Converter.EVENT_CREATE_DECLARATION, handleDefineComponent);
    app.converter.on(
        Converter.EVENT_CREATE_DECLARATION,
        collectStoreReferences,
    );
    app.converter.on(
        Converter.EVENT_CREATE_DECLARATION,
        functionalComponentToClass,
    );
    app.converter.on(Converter.EVENT_CREATE_SIGNATURE, handleDefineStore);

    app.converter.on(
        Converter.EVENT_RESOLVE_BEGIN,
        (context) => {
            for (const decl of functionalComponentReflections) {
                for (const sig of decl.signatures?.slice() || []) {
                    context.project.removeReflection(sig);
                }

                if (app.options.getValue("excludeVueProperties")) {
                    for (const prop of functionalComponentProperties) {
                        const reflProp = decl.getChildByName([prop]);
                        if (reflProp) {
                            context.project.removeReflection(reflProp);
                        }
                    }
                }
            }
            functionalComponentReflections.clear();

            for (const refl of storeLinks.values()) {
                const $id = refl.getChildByName(["$id"]);
                if ($id) {
                    context.project.removeReflection($id);
                }
            }
        },
        1000,
    );

    app.converter.on(Converter.EVENT_END, (context: Context) => {
        for (const [src, target] of storeLinks) {
            const references = storeReferences.get(src) || [];
            for (const src of references) {
                src.type = ReferenceType.createBrokenReference(
                    "PiniaStore",
                    context.project,
                );
                src.type.typeArguments = [
                    ReferenceType.createResolvedReference(
                        target.name,
                        target,
                        context.project,
                    ),
                ];

                delete src.defaultValue;
            }
        }

        storeLinks.clear();
        storeReferences.clear();
    });
}

function collectStoreReferences(context: Context, refl: DeclarationReflection) {
    if (!refl.kindOf(ReflectionKind.Property)) {
        return;
    }

    const declaration = getSymbolFromReflection(context, refl)
        ?.getDeclarations()?.[0];

    if (
        !declaration
        || !ts.isPropertyAssignment(declaration)
        || !declaration.initializer
        || !ts.isCallExpression(declaration.initializer)
    ) {
        return;
    }

    let fnName: ts.Expression = declaration.initializer.expression;
    while (ts.isBinaryExpression(fnName)) {
        fnName = fnName.right;
    }
    if (!ts.isIdentifier(fnName)) return;

    const symbol = context.getSymbolAtLocation(fnName);
    if (!symbol) return;

    if (storeReferences.has(symbol)) {
        storeReferences.get(symbol)!.push(refl);
    } else {
        storeReferences.set(symbol, [refl]);
    }
}

const defineComponentProperties = [
    "_pStores",
    "$",
    "$attrs",
    "$data",
    "$el",
    "$emit",
    "$forceUpdate",
    "$host",
    "$nextTick",
    "$options",
    "$parent",
    "$props",
    "$refs",
    "$root",
    "$slots",
    "$watch",
    // Only if using pinia
    "$pinia",
];

function handleDefineComponent(context: Context, refl: DeclarationReflection) {
    if (
        !refl.kindOf(ReflectionKind.Variable)
        || refl.type?.type !== "reference"
        || refl.type.package !== "@vue/runtime-core"
        || refl.type.qualifiedName !== "DefineComponent"
    ) {
        return;
    }

    const declaration = getSymbolFromReflection(context, refl)
        ?.getDeclarations()?.[0];
    if (!declaration) return;

    const type = context.getTypeAtLocation(declaration);
    if (!type) return;

    const instanceType = type.getConstructSignatures()[0]?.getReturnType();
    if (!instanceType) return;

    refl.setFlag(ReflectionFlag.Const, false);
    refl.kind = ReflectionKind.Class;

    for (const prop of instanceType.getProperties()) {
        if (
            !context.converter.application.options.getValue(
                "excludeVueProperties",
            )
            || !defineComponentProperties.includes(prop.name)
        ) {
            context.converter.convertSymbol(context.withScope(refl), prop);
        }
    }

    context.project.removeTypeReflections?.(refl.type);
    delete refl.type;
    delete refl.defaultValue;
}

function functionalComponentToClass(
    context: Context,
    refl: DeclarationReflection,
) {
    const symbol = getSymbolFromReflection(context, refl);
    const decl = symbol?.getDeclarations()?.[0];

    if (
        !decl
        || !ts.isVariableDeclaration(decl)
        || !decl.type
        || !ts.isTypeReferenceNode(decl.type)
    ) {
        return;
    }

    const declaredType = context.checker.getTypeAtLocation(decl.type);

    if (
        !isReferenceType(declaredType)
        || declaredType.getSymbol()?.name !== "FunctionalComponent"
    ) {
        return;
    }

    const typeArgs = context.checker.getTypeArguments(declaredType);
    if (typeArgs.length < 1) return;

    const propType = typeArgs[0];

    // Convert this reflection to a class
    refl.setFlag(ReflectionFlag.Const, false);
    refl.kind = ReflectionKind.Class;

    for (const prop of propType.getProperties()) {
        context.converter.convertSymbol(context.withScope(refl), prop);
    }

    functionalComponentReflections.add(refl);
}

const piniaProperties = new Set([
    "$state",
    "$patch",
    "$reset",
    "$subscribe",
    "$onAction",
    "$dispose",
    "$id",
    "_customProperties",
]);

function handleDefineStore(context: Context, refl: SignatureReflection) {
    if (
        !refl.kindOf(ReflectionKind.CallSignature)
        || refl?.type?.type !== "reference"
        || refl.type.package !== "pinia"
        || refl.type.qualifiedName !== "Store"
    ) {
        return;
    }

    const symbol = getSymbolFromReflection(context, refl.parent);
    if (!symbol) return;

    const type = context.checker
        .getTypeOfSymbol(symbol)
        .getCallSignatures()[0]
        ?.getReturnType();
    if (!type) return;

    storeLinks.set(symbol, refl.parent);

    // Kind of hacky... TypeDoc converts callable things as functions unless they're
    // on a class or interface, which we want to kind of pretend this store is.
    const originalKind = refl.parent.kind;
    refl.parent.kind = ReflectionKind.Class;
    for (const prop of type.getProperties()) {
        if (!piniaProperties.has(prop.name)) {
            context.converter.convertSymbol(
                context.withScope(refl.parent),
                prop,
            );
        }
    }
    refl.parent.kind = originalKind;

    refl.type = ReferenceType.createBrokenReference(
        "PiniaStore",
        context.project,
    );
    refl.type.typeArguments = [
        ReferenceType.createResolvedReference(
            refl.parent.name,
            refl.parent,
            context.project,
        ),
    ];
}

function isObjectType(type: ts.Type): type is ts.ObjectType {
    return typeof (type as any).objectFlags === "number";
}

function isReferenceType(type: ts.Type): type is ts.TypeReference {
    return (
        isObjectType(type)
        && (type.objectFlags & ts.ObjectFlags.Reference) !== 0
    );
}

function getSymbolFromReflection(context: Context, refl: Reflection) {
    if ("getSymbolFromReflection" in context) {
        // TypeDoc 0.28
        return context.getSymbolFromReflection(refl);
    }
    // TypeDoc <0.28
    return (refl.project as any).getSymbolFromReflection(refl);
}
