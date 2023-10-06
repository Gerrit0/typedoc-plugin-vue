import {
    Application,
    Context,
    Converter,
    DeclarationReflection,
    ReferenceReflection,
    ReferenceType,
    ReflectionFlag,
    ReflectionKind,
    ReflectionType,
    SignatureReflection,
    TypeScript as ts,
} from "typedoc";

// store function symbol -> reflection id that documents it
const storeLinks = new Map<ts.Symbol, DeclarationReflection>();
// properties/variables which reference a store
const storeReferences = new Map<ts.Symbol, DeclarationReflection[]>();

export function load(app: Application) {
    app.converter.on(Converter.EVENT_CREATE_DECLARATION, handleDefineComponent);
    app.converter.on(
        Converter.EVENT_CREATE_DECLARATION,
        collectStoreReferences,
    );
    app.converter.on(Converter.EVENT_CREATE_SIGNATURE, handleDefineStore);

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

    const declaration = refl.project
        .getSymbolFromReflection(refl)
        ?.getDeclarations()?.[0];

    if (
        !declaration ||
        !ts.isPropertyAssignment(declaration) ||
        !declaration.initializer ||
        !ts.isCallExpression(declaration.initializer)
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

function handleDefineComponent(context: Context, refl: DeclarationReflection) {
    if (
        !refl.kindOf(ReflectionKind.Variable) ||
        refl.type?.type !== "reference" ||
        refl.type.package !== "@vue/runtime-core" ||
        refl.type.qualifiedName !== "DefineComponent"
    ) {
        return;
    }

    const declaration = refl.project
        .getSymbolFromReflection(refl)
        ?.getDeclarations()?.[0];
    if (!declaration) return;

    const type = context.getTypeAtLocation(declaration);
    if (!type) return;

    const instanceType = type.getConstructSignatures()[0]?.getReturnType();
    if (!instanceType) return;

    refl.setFlag(ReflectionFlag.Const, false);
    refl.kind = ReflectionKind.Class;

    for (const prop of instanceType.getProperties()) {
        context.converter.convertSymbol(context.withScope(refl), prop);
    }
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
        !refl.kindOf(ReflectionKind.CallSignature) ||
        refl?.type?.type !== "reference" ||
        refl.type.package !== "pinia" ||
        refl.type.qualifiedName !== "Store"
    ) {
        return;
    }

    const symbol = context.project.getSymbolFromReflection(refl.parent);
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
