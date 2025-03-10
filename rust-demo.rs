// Rust example to test syntax highlighting
fn main() {
    // Print a hello message
    println!("Hello from Rust! Testing syntax highlighting");
    
    // Define a vector of numbers
    let numbers = vec![1, 2, 3, 4, 5];
    
    // Use map to double each number and collect into a new vector
    let doubled: Vec<i32> = numbers.iter()
        .map(|&x| x * 2)
        .collect();
    
    // Print the results
    println!("Original numbers: {:?}", numbers);
    println!("Doubled numbers: {:?}", doubled);
    
    // Define a simple struct
    struct Person {
        name: String,
        age: u32,
    }
    
    // Create an instance of the struct
    let person = Person {
        name: String::from("Alice"),
        age: 30,
    };
    
    // Print person information
    println!("{} is {} years old", person.name, person.age);
}