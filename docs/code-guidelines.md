#### Rust Specific
- For from String to Object (primitive or complex) implement `FromStr` trait instead of `From<&str>`
- Implement From or TryFrom trait if possible. In other cases implemented from_xy member function

#### General - Based upon [CPP Core Guidelines](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines#c-core-guidelines)

- [P.3 Express intent](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines#p3-express-intent)
- [P.7 Catch run-time errors early](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines#p7-catch-run-time-errors-early)
- [I.4: Make interfaces precisely and strongly typed](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines#i4-make-interfaces-precisely-and-strongly-typed)
- [I.23: Keep the number of function arguments low](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines#i23-keep-the-number-of-function-arguments-low)
- [F.1: “Package” meaningful operations as carefully named functions](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines#f1-package-meaningful-operations-as-carefully-named-functions)
- [F.2: A function should perform a single logical operation](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines#f2-a-function-should-perform-a-single-logical-operation)
- [F.3: Keep functions short and simple](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines#f3-keep-functions-short-and-simple)
- [F.7: For general use, take T* or T& arguments rather than smart pointers](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines#f7-for-general-use-take-t-or-t-arguments-rather-than-smart-pointers)
- [F.56: Avoid unnecessary condition nesting](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines#f56-avoid-unnecessary-condition-nesting)
- [C.1: Organize related data into structures](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines#c1-organize-related-data-into-structures-structs-or-classes)
- [C.4: Make a function a member only if it needs direct access to the representation of a class](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines#c4-make-a-function-a-member-only-if-it-needs-direct-access-to-the-representation-of-a-class)
- [ES.3: Don’t repeat yourself, avoid redundant code](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines#res-dry)
- [ES.5: Keep scopes small](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines#es5-keep-scopes-small)
- [ES.7: Keep common and local names short, and keep uncommon and non-local names longer](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines#es7-keep-common-and-local-names-short-and-keep-uncommon-and-non-local-names-longer)
- [ES.8: Avoid similar-looking names](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines#es7-keep-common-and-local-names-short-and-keep-uncommon-and-non-local-names-longer)
- [ES.21: Don’t introduce a variable (or constant) before you need to use it](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines#es21-dont-introduce-a-variable-or-constant-before-you-need-to-use-it)
- [ES.26: Don’t use a variable for two unrelated purposes](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines#es26-dont-use-a-variable-for-two-unrelated-purposes)
- [ES.45: Avoid “magic constants”; use symbolic constants](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines#es45-avoid-magic-constants-use-symbolic-constants)
- [ES.76: Avoid goto](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines#es76-avoid-goto)
- [Performance](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines#per-performance)
    - Basically this whole section is relevant. It's short so please read it all.