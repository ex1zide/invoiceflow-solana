use std::{collections::HashMap, env, process};

const LAMPORTS_PER_SOL: u64 = 1_000_000_000;
// A fixed fee used ONLY by this local model; actual network fees are read from RPC.
const DEMO_FEE: u64 = 5_000;

#[derive(Debug, Clone)]
struct Account {
    label: String,
    lamports: u64,
}

#[derive(Debug)]
struct Receipt {
    from: String,
    to: String,
    lamports: u64,
    fee: u64,
}

enum Command {
    Demo,
    Balance(String),
    Convert(u64),
    Transfer { from: String, to: String, amount: u64 },
    Help,
}

// Parse decimal text with integer arithmetic: never round SOL through f64.
fn parse_sol(value: &str) -> Result<u64, String> {
    let (whole, fraction) = value.split_once('.').unwrap_or((value, ""));
    if whole.is_empty()
        || !whole.bytes().all(|c| c.is_ascii_digit())
        || !fraction.bytes().all(|c| c.is_ascii_digit())
        || fraction.len() > 9
        || (value.contains('.') && fraction.is_empty())
    {
        return Err("Use a nonnegative decimal with at most 9 fractional digits.".into());
    }
    let whole: u64 = whole.parse().map_err(|_| "Amount exceeds u64.")?;
    let fraction: u64 = if fraction.is_empty() {
        0
    } else {
        fraction.parse::<u64>().map_err(|_| "Invalid fraction.")?
            * 10_u64.pow((9 - fraction.len()) as u32)
    };
    whole.checked_mul(LAMPORTS_PER_SOL)
        .and_then(|v| v.checked_add(fraction))
        .ok_or_else(|| "Amount exceeds u64 lamports.".into())
}

fn format_sol(lamports: u64) -> String {
    format!("{}.{:09}", lamports / LAMPORTS_PER_SOL, lamports % LAMPORTS_PER_SOL)
}

fn parse_command(args: &[String]) -> Result<Command, String> {
    match args.first().map(String::as_str) {
        None | Some("help" | "--help" | "-h") if args.len() <= 1 => Ok(Command::Help),
        Some("demo") if args.len() == 1 => Ok(Command::Demo),
        Some("balance") if args.len() == 2 => Ok(Command::Balance(args[1].clone())),
        Some("convert") if args.len() == 2 => Ok(Command::Convert(parse_sol(&args[1])?)),
        Some("transfer") if args.len() == 4 => Ok(Command::Transfer {
            from: args[1].clone(), to: args[2].clone(), amount: parse_sol(&args[3])?,
        }),
        _ => Err("Unknown command or wrong argument count. Run with --help.".into()),
    }
}

fn initial_accounts() -> HashMap<String, Account> {
    [
        Account { label: "alice".into(), lamports: LAMPORTS_PER_SOL },
        Account { label: "bob".into(), lamports: 0 },
    ].into_iter().map(|account| (account.label.clone(), account)).collect()
}

fn transfer(
    accounts: &mut HashMap<String, Account>, from: &str, to: &str, amount: u64,
) -> Result<Receipt, String> {
    if from == to { return Err("Choose two different accounts.".into()); }
    if amount == 0 { return Err("Transfer amount must be positive.".into()); }
    let sender = accounts.get(from).ok_or("Sender account does not exist.")?;
    let recipient = accounts.get(to).ok_or("Recipient account does not exist.")?;
    let debit = amount.checked_add(DEMO_FEE).ok_or("Amount plus fee overflows u64.")?;
    let new_sender = sender.lamports.checked_sub(debit).ok_or("Insufficient balance including fee.")?;
    let new_recipient = recipient.lamports.checked_add(amount).ok_or("Recipient balance overflows u64.")?;
    // Validate everything before changing either balance.
    accounts.get_mut(from).expect("validated sender").lamports = new_sender;
    accounts.get_mut(to).expect("validated recipient").lamports = new_recipient;
    Ok(Receipt { from: from.into(), to: to.into(), lamports: amount, fee: DEMO_FEE })
}

fn print_accounts(accounts: &HashMap<String, Account>) {
    let mut labels: Vec<&String> = accounts.keys().collect();
    labels.sort();
    for label in labels {
        let account = &accounts[label];
        println!("{}: {} SOL ({} lamports)", account.label, format_sol(account.lamports), account.lamports);
    }
}

fn print_receipt(receipt: &Receipt) {
    println!("Transfer {} -> {}: {} SOL ({} lamports); model fee {} lamports",
        receipt.from, receipt.to, format_sol(receipt.lamports), receipt.lamports, receipt.fee);
}

fn run() -> Result<(), String> {
    let args: Vec<String> = env::args().skip(1).collect();
    let command = parse_command(&args)?;
    let mut accounts = initial_accounts();
    println!("LOCAL EDUCATIONAL MODEL. No network transaction. Balances reset each run.");
    match command {
        Command::Help => println!("Commands:\n  demo\n  balance <alice|bob>\n  convert <SOL>\n  transfer <from> <to> <SOL>"),
        Command::Balance(label) => {
            let account = accounts.get(&label).ok_or("Account does not exist.")?;
            println!("{}: {} SOL ({} lamports)", account.label, format_sol(account.lamports), account.lamports);
        }
        Command::Convert(amount) => println!("{} SOL = {} lamports", format_sol(amount), amount),
        Command::Transfer { from, to, amount } => {
            print_receipt(&transfer(&mut accounts, &from, &to, amount)?);
            print_accounts(&accounts);
        }
        Command::Demo => {
            println!("Before:");
            print_accounts(&accounts);
            print_receipt(&transfer(&mut accounts, "alice", "bob", parse_sol("0.001")?)?);
            println!("After:");
            print_accounts(&accounts);
        }
    }
    Ok(())
}

fn main() {
    if let Err(error) = run() {
        eprintln!("Error: {error}");
        process::exit(1);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decimal_precision_and_u64_boundary() {
        assert_eq!(parse_sol("0.000000001"), Ok(1));
        assert_eq!(parse_sol("0.001"), Ok(1_000_000));
        assert_eq!(parse_sol("18446744073.709551615"), Ok(u64::MAX));
        for invalid in ["18446744073.709551616", "0.0000000001", "-1", "NaN", "1e3", "1.2.3", "1."] {
            assert!(parse_sol(invalid).is_err(), "accepted {invalid}");
        }
    }

    #[test]
    fn transfer_changes_balances_and_accounts_for_fee() {
        let mut accounts = initial_accounts();
        let receipt = transfer(&mut accounts, "alice", "bob", 1_000_000).unwrap();
        assert_eq!(receipt.lamports, 1_000_000);
        assert_eq!(accounts["alice"].lamports, 998_995_000);
        assert_eq!(accounts["bob"].lamports, 1_000_000);
        assert_eq!(accounts.values().map(|a| a.lamports).sum::<u64>() + DEMO_FEE, LAMPORTS_PER_SOL);
    }

    #[test]
    fn rejected_transfer_preserves_both_balances() {
        let mut accounts = initial_accounts();
        assert!(transfer(&mut accounts, "alice", "bob", LAMPORTS_PER_SOL).is_err());
        assert_eq!(accounts["alice"].lamports, LAMPORTS_PER_SOL);
        assert_eq!(accounts["bob"].lamports, 0);
        accounts.get_mut("bob").unwrap().lamports = u64::MAX;
        assert!(transfer(&mut accounts, "alice", "bob", 1).is_err());
        assert_eq!(accounts["alice"].lamports, LAMPORTS_PER_SOL);
        assert_eq!(accounts["bob"].lamports, u64::MAX);
    }
}
