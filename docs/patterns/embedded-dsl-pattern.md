# Embedded Rust DSL: The Art of Fluent APIs

## What is an Embedded DSL?

An Embedded Domain-Specific Language (DSL) is a mini-language built within a host language that feels like a specialized tool while leveraging the host's full power. In Rust, we create fluent, type-safe APIs that read like domain-specific syntax but compile to regular Rust code.

Think of it as writing poetry that also happens to be executable code.

## The Philosophy

> "Make the complex simple and the simple powerful."  
> — Embedded DSL Manifesto

Embedded DSLs in Rust excel at:
- **Expressiveness**: Code reads like the problem domain
- **Type Safety**: Compile-time guarantees prevent invalid states
- **Performance**: Zero-cost abstractions, no runtime parsing
- **Tooling**: Full IDE support, refactoring, and debugging

## Core Patterns

### 1. The Builder Pattern Foundation

```rust
// The classic builder, but with personality
pub struct PizzaBuilder {
    dough: Option<DoughType>,
    sauce: Option<SauceType>,
    toppings: Vec<Topping>,
    cheese: bool,
}

impl PizzaBuilder {
    pub fn new() -> Self {
        Self {
            dough: None,
            sauce: None,
            toppings: Vec::new(),
            cheese: true, // Sensible defaults
        }
    }
    
    // Method chaining for fluency
    pub fn with_dough(mut self, dough: DoughType) -> Self {
        self.dough = Some(dough);
        self
    }
    
    pub fn with_sauce(mut self, sauce: SauceType) -> Self {
        self.sauce = Some(sauce);
        self
    }
    
    pub fn add_topping(mut self, topping: Topping) -> Self {
        self.toppings.push(topping);
        self
    }
    
    pub fn hold_cheese(mut self) -> Self {
        self.cheese = false;
        self
    }
    
    pub fn bake(self) -> Result<Pizza, PizzaError> {
        // Validation and construction
        Pizza::new(
            self.dough.ok_or(PizzaError::MissingDough)?,
            self.sauce.ok_or(PizzaError::MissingSauce)?,
            self.toppings,
            self.cheese,
        )
    }
}

// Usage that reads like a recipe
let pizza = PizzaBuilder::new()
    .with_dough(DoughType::WholeWheat)
    .with_sauce(SauceType::Marinara)
    .add_topping(Topping::Pepperoni)
    .add_topping(Topping::Mushrooms)
    .hold_cheese()
    .bake()?;
```

### 2. The Fluent Configuration Pattern

```rust
// Configuration that reads like natural language
pub struct ServerConfig {
    host: String,
    port: u16,
    ssl: bool,
    max_connections: usize,
    timeout: Duration,
    log_level: LogLevel,
}

pub struct ConfigBuilder {
    config: ServerConfig,
}

impl ConfigBuilder {
    pub fn new() -> Self {
        Self {
            config: ServerConfig::default(),
        }
    }
    
    pub fn listening_on(mut self, address: &str) -> Self {
        let (host, port) = address.split_once(':')
            .unwrap_or(("localhost", "8080"));
        self.config.host = host.to_string();
        self.config.port = port.parse().unwrap_or(8080);
        self
    }
    
    pub fn with_ssl_enabled(mut self) -> Self {
        self.config.ssl = true;
        self
    }
    
    pub fn allowing_up_to(mut self, connections: usize) -> Self {
        self.config.max_connections = connections;
        self
    }
    
    pub fn timing_out_after(mut self, duration: Duration) -> Self {
        self.config.timeout = duration;
        self
    }
    
    pub fn logging_at(mut self, level: LogLevel) -> Self {
        self.config.log_level = level;
        self
    }
    
    pub fn start(self) -> Result<Server, ConfigError> {
        Server::from_config(self.config)
    }
}

// Usage that reads like a specification
let server = ConfigBuilder::new()
    .listening_on("0.0.0.0:443")
    .with_ssl_enabled()
    .allowing_up_to(1000)
    .timing_out_after(Duration::from_secs(30))
    .logging_at(LogLevel::Info)
    .start()?;
```

### 3. The Query Builder Pattern

```rust
// Database queries that read like English sentences
pub struct QueryBuilder {
    table: Option<String>,
    columns: Vec<String>,
    conditions: Vec<Condition>,
    order_by: Vec<String>,
    limit: Option<usize>,
}

impl QueryBuilder {
    pub fn select() -> Self {
        Self {
            table: None,
            columns: Vec::new(),
            conditions: Vec::new(),
            order_by: Vec::new(),
            limit: None,
        }
    }
    
    pub fn from(mut self, table: &str) -> Self {
        self.table = Some(table.to_string());
        self
    }
    
    pub fn columns(mut self, cols: &[&str]) -> Self {
        self.columns = cols.iter().map(|&c| c.to_string()).collect();
        self
    }
    
    pub fn all_columns(mut self) -> Self {
        self.columns.push("*".to_string());
        self
    }
    
    pub fn where_eq(mut self, column: &str, value: &str) -> Self {
        self.conditions.push(Condition::Equals(column.to_string(), value.to_string()));
        self
    }
    
    pub fn where_like(mut self, column: &str, pattern: &str) -> Self {
        self.conditions.push(Condition::Like(column.to_string(), pattern.to_string()));
        self
    }
    
    pub fn and_where(mut self, condition: Condition) -> Self {
        self.conditions.push(condition);
        self
    }
    
    pub fn order_by(mut self, column: &str) -> Self {
        self.order_by.push(column.to_string());
        self
    }
    
    pub fn limit(mut self, count: usize) -> Self {
        self.limit = Some(count);
        self
    }
    
    pub fn build(self) -> Result<Query, QueryError> {
        Query::new(self)
    }
}

// Usage that reads like a natural query
let query = QueryBuilder::select()
    .from("users")
    .columns(&["id", "name", "email"])
    .where_eq("status", "active")
    .and_where(Condition::Like("name", "John%"))
    .order_by("name")
    .limit(10)
    .build()?;
```

### 4. The State Machine Pattern

```rust
// State machines that read like flowcharts
pub struct TrafficLight {
    state: LightState,
    timer: Duration,
}

#[derive(Debug, Clone)]
pub enum LightState {
    Red,
    Yellow,
    Green,
}

impl TrafficLight {
    pub fn new() -> Self {
        Self {
            state: LightState::Red,
            timer: Duration::from_secs(30),
        }
    }
    
    pub fn when_red(mut self, duration: Duration) -> Self {
        self.state = LightState::Red;
        self.timer = duration;
        self
    }
    
    pub fn when_green(mut self, duration: Duration) -> Self {
        self.state = LightState::Green;
        self.timer = duration;
        self
    }
    
    pub fn when_yellow(mut self, duration: Duration) -> Self {
        self.state = LightState::Yellow;
        self.timer = duration;
        self
    }
    
    pub fn then_transition_to(mut self, next_state: LightState) -> Self {
        // Logic for state transition
        self.state = next_state;
        self
    }
    
    pub fn start_cycle(self) -> TrafficLightController {
        TrafficLightController::new(self)
    }
}

// Usage that reads like a traffic light specification
let light_cycle = TrafficLight::new()
    .when_red(Duration::from_secs(30))
    .then_transition_to(LightState::Green)
    .when_green(Duration::from_secs(45))
    .then_transition_to(LightState::Yellow)
    .when_yellow(Duration::from_secs(5))
    .then_transition_to(LightState::Red)
    .start_cycle();
```

### 5. The Animation/Effect Pattern

```rust
// Animations that read like storyboards
pub struct AnimationBuilder {
    target: Option<String>,
    duration: Duration,
    easing: EasingFunction,
    keyframes: Vec<Keyframe>,
}

impl AnimationBuilder {
    pub fn animate() -> Self {
        Self {
            target: None,
            duration: Duration::from_millis(1000),
            easing: EasingFunction::Linear,
            keyframes: Vec::new(),
        }
    }
    
    pub fn the_element(mut self, selector: &str) -> Self {
        self.target = Some(selector.to_string());
        self
    }
    
    pub fn over(mut self, duration: Duration) -> Self {
        self.duration = duration;
        self
    }
    
    pub fn with_easing(mut self, easing: EasingFunction) -> Self {
        self.easing = easing;
        self
    }
    
    pub fn from(mut self, properties: Properties) -> Self {
        self.keyframes.push(Keyframe::Start(properties));
        self
    }
    
    pub fn to(mut self, properties: Properties) -> Self {
        self.keyframes.push(Keyframe::End(properties));
        self
    }
    
    pub fn via(mut self, properties: Properties, at: f32) -> Self {
        self.keyframes.push(Keyframe::Intermediate(properties, at));
        self
    }
    
    pub fn play(self) -> Result<Animation, AnimationError> {
        Animation::new(self)
    }
}

// Usage that reads like animation directions
let fade_in = AnimationBuilder::animate()
    .the_element("#hero")
    .over(Duration::from_millis(800))
    .with_easing(EasingFunction::EaseInOut)
    .from(Properties::new().opacity(0.0).transform("scale(0.8)"))
    .via(Properties::new().opacity(0.5).transform("scale(1.0)"), 0.5)
    .to(Properties::new().opacity(1.0).transform("scale(1.0)"))
    .play()?;
```

## Advanced Techniques

### 1. Type-Level State Machines

```rust
// Compile-time guaranteed state transitions
pub struct Locked;
pub struct Unlocked;

pub struct Door<State> {
    _state: PhantomData<State>,
}

impl Door<Locked> {
    pub fn unlock(self, key: &Key) -> Result<Door<Unlocked>, UnlockError> {
        if key.is_valid() {
            Ok(Door { _state: PhantomData })
        } else {
            Err(UnlockError::InvalidKey)
        }
    }
}

impl Door<Unlocked> {
    pub fn lock(self, key: &Key) -> Door<Locked> {
        Door { _state: PhantomData }
    }
    
    pub fn open(&self) -> Result<(), OpenError> {
        // Door opening logic
        Ok(())
    }
}
```

### 2. Phantom Types for Domain Safety

```rust
// Prevent mixing incompatible units
pub struct Meters;
pub struct Feet;

pub struct Length<Unit> {
    value: f64,
    _unit: PhantomData<Unit>,
}

impl Length<Meters> {
    pub fn meters(value: f64) -> Self {
        Self { value, _unit: PhantomData }
    }
    
    pub fn to_feet(&self) -> Length<Feet> {
        Length { value: self.value * 3.28084, _unit: PhantomData }
    }
}

impl Length<Feet> {
    pub fn feet(value: f64) -> Self {
        Self { value, _unit: PhantomData }
    }
    
    pub fn to_meters(&self) -> Length<Meters> {
        Length { value: self.value / 3.28084, _unit: PhantomData }
    }
}

// Compile-time error: can't add meters and feet directly
// let total = Length::meters(5.0) + Length::feet(10.0); // Won't compile!
```

### 3. Zero-Sized Types for Behavior

```rust
// Strategy pattern with zero-cost abstractions
pub trait SortingStrategy {
    fn sort<T: Ord>(&self, data: &mut [T]);
}

pub struct BubbleSort;
pub struct QuickSort;
pub struct MergeSort;

impl SortingStrategy for BubbleSort {
    fn sort<T: Ord>(&self, data: &mut [T]) {
        // Bubble sort implementation
    }
}

impl SortingStrategy for QuickSort {
    fn sort<T: Ord>(&self, data: &mut [T]) {
        // Quick sort implementation
    }
}

pub struct Sorter<S: SortingStrategy> {
    strategy: S,
}

impl<S: SortingStrategy> Sorter<S> {
    pub fn with_strategy(strategy: S) -> Self {
        Self { strategy }
    }
    
    pub fn sort<T: Ord>(&self, data: &mut [T]) {
        self.strategy.sort(data);
    }
}

// Usage
let sorter = Sorter::with_strategy(QuickSort);
sorter.sort(&mut my_array);
```

## The Art of DSL Design

### Principles

1. **Readability First**: Code should read like the problem domain
2. **Discoverability**: Methods should be intuitive and autocomplete-friendly
3. **Composability**: Small pieces combine into powerful solutions
4. **Type Safety**: Prevent invalid states at compile time
5. **Performance**: Zero-cost abstractions where possible

### Anti-Patterns to Avoid

- **Over-engineering**: Don't create a DSL for simple problems
- **Inconsistent naming**: Mix conventions (camelCase vs snake_case)
- **Hidden complexity**: Magic that's hard to debug
- **Tight coupling**: DSL that only works for one specific case

### Naming Conventions

```rust
// Good: Reads like natural language
server
    .listening_on("localhost:8080")
    .with_ssl_enabled()
    .allowing_up_to(1000)
    .start()?;

// Bad: Inconsistent and unclear
server
    .bind("localhost:8080")
    .ssl(true)
    .max_conn(1000)
    .run()?;
```

## Real-World Examples

### 1. Web Framework Routing

```rust
// Actix-web style routing
HttpServer::new(|| {
    App::new()
        .route("/", web::get().to(index))
        .route("/users", web::post().to(create_user))
        .route("/users/{id}", web::get().to(get_user))
        .route("/users/{id}", web::put().to(update_user))
        .route("/users/{id}", web::delete().to(delete_user))
})
.bind("127.0.0.1:8080")?
.run();
```

### 2. Testing Frameworks

```rust
// Mockall style mocking
let mut mock = MyTrait::mock();
mock.expect_method()
    .with(eq(42))
    .times(1)
    .returning(|x| x * 2);
```

### 3. Configuration Management

```rust
// Config style configuration
let settings = Config::builder()
    .add_source(config::File::with_name("config/default"))
    .add_source(config::File::with_name("config/local").required(false))
    .add_source(config::Environment::with_prefix("APP"))
    .build()?;
```

## When to Use Embedded DSLs

**Perfect for:**
- Configuration and setup code
- Query builders and data access
- Animation and effect systems
- State machines and workflows
- Testing and mocking frameworks
- Domain-specific business logic

**Avoid for:**
- Simple one-off operations
- Performance-critical inner loops
- Algorithms with complex mathematical requirements
- Situations where explicit code is clearer

## Conclusion

Embedded DSLs in Rust are about finding the sweet spot between expressiveness and type safety. They transform complex operations into readable, maintainable code that feels natural to write and understand.

The best DSLs are those that make you forget you're writing code at all—you're simply describing the solution in the language of the problem domain.

> "Code is read more often than it is written."  
> — Guido van Rossum

Make your code a joy to read, and the embedded DSL pattern in Rust is one of the most powerful tools for achieving that goal.
