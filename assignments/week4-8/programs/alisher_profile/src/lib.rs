use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

declare_id!("5EHY5pYduZMone4MRBy45Lkrrofupq1G3R1ADV9w7qXU");

#[program]
pub mod alisher_profile {
    use super::*;

    // Неделя 4: первый вызов программы записывает сообщение в журнал.
    pub fn hello(_ctx: Context<Hello>) -> Result<()> {
        msg!("Hello from Alisher's Solana program");
        Ok(())
    }

    // Неделя 5: у каждого владельца свой счётчик.
    pub fn initialize_counter(ctx: Context<InitializeCounter>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.owner = ctx.accounts.owner.key();
        counter.value = 0;
        counter.bump = ctx.bumps.counter;
        Ok(())
    }

    pub fn increment(ctx: Context<UpdateCounter>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.value = counter.value.checked_add(1).ok_or(ProfileError::Overflow)?;
        Ok(())
    }

    // Неделя 6: профиль находится по PDA, рассчитанному из адреса владельца.
    pub fn create_profile(
        ctx: Context<CreateProfile>,
        name: String,
        bio: String,
    ) -> Result<()> {
        check_text(&name, &bio)?;
        let profile = &mut ctx.accounts.profile;
        profile.owner = ctx.accounts.owner.key();
        profile.name = name;
        profile.bio = bio;
        profile.bump = ctx.bumps.profile;
        Ok(())
    }

    pub fn update_profile(
        ctx: Context<UpdateProfile>,
        name: String,
        bio: String,
    ) -> Result<()> {
        check_text(&name, &bio)?;
        let profile = &mut ctx.accounts.profile;
        profile.name = name;
        profile.bio = bio;
        Ok(())
    }

    pub fn create_invoice(ctx: Context<CreateInvoice>, id: u64, amount: u64, title: String) -> Result<()> {
        require!(amount > 0, ProfileError::InvalidAmount);
        require!(!title.trim().is_empty() && title.as_bytes().len() <= 64, ProfileError::InvalidTitle);
        require_keys_neq!(ctx.accounts.merchant.key(), ctx.accounts.customer.key(), ProfileError::SameParty);
        let invoice = &mut ctx.accounts.invoice;
        invoice.id = id;
        invoice.merchant = ctx.accounts.merchant.key();
        invoice.customer = ctx.accounts.customer.key();
        invoice.mint = ctx.accounts.mint.key();
        invoice.amount = amount;
        invoice.title = title;
        invoice.status = InvoiceStatus::Pending;
        invoice.bump = ctx.bumps.invoice;
        Ok(())
    }

    pub fn pay_invoice(ctx: Context<PayInvoice>) -> Result<()> {
        require!(ctx.accounts.invoice.status == InvoiceStatus::Pending, ProfileError::InvoiceClosed);
        token_interface::transfer_checked(
            CpiContext::new(ctx.accounts.token_program.to_account_info(), TransferChecked {
                from: ctx.accounts.customer_token.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.merchant_token.to_account_info(),
                authority: ctx.accounts.customer.to_account_info(),
            }),
            ctx.accounts.invoice.amount,
            ctx.accounts.mint.decimals,
        )?;
        ctx.accounts.invoice.status = InvoiceStatus::Paid;
        ctx.accounts.invoice.paid_at = Clock::get()?.unix_timestamp;
        Ok(())
    }

    pub fn cancel_invoice(ctx: Context<CancelInvoice>) -> Result<()> {
        require!(ctx.accounts.invoice.status == InvoiceStatus::Pending, ProfileError::InvoiceClosed);
        ctx.accounts.invoice.status = InvoiceStatus::Cancelled;
        Ok(())
    }
}

fn check_text(name: &str, bio: &str) -> Result<()> {
    require!(!name.trim().is_empty(), ProfileError::EmptyName);
    require!(name.as_bytes().len() <= 64, ProfileError::NameTooLong);
    require!(bio.as_bytes().len() <= 160, ProfileError::BioTooLong);
    Ok(())
}

#[derive(Accounts)]
pub struct Hello<'info> {
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct InitializeCounter<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + Counter::INIT_SPACE,
        seeds = [b"counter", owner.key().as_ref()],
        bump
    )]
    pub counter: Account<'info, Counter>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateCounter<'info> {
    #[account(
        mut,
        seeds = [b"counter", owner.key().as_ref()],
        bump = counter.bump,
        has_one = owner
    )]
    pub counter: Account<'info, Counter>,
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct CreateProfile<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + Profile::INIT_SPACE,
        seeds = [b"profile", owner.key().as_ref()],
        bump
    )]
    pub profile: Account<'info, Profile>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateProfile<'info> {
    #[account(
        mut,
        seeds = [b"profile", owner.key().as_ref()],
        bump = profile.bump,
        has_one = owner
    )]
    pub profile: Account<'info, Profile>,
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct CreateInvoice<'info> {
    #[account(init, payer = merchant, space = 8 + Invoice::INIT_SPACE,
        seeds = [b"invoice", merchant.key().as_ref(), &id.to_le_bytes()], bump)]
    pub invoice: Account<'info, Invoice>,
    #[account(mut)]
    pub merchant: Signer<'info>,
    /// CHECK: Public customer address is stored in the invoice; their signature is required for payment.
    pub customer: UncheckedAccount<'info>,
    pub mint: InterfaceAccount<'info, Mint>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PayInvoice<'info> {
    #[account(mut, seeds = [b"invoice", invoice.merchant.as_ref(), &invoice.id.to_le_bytes()], bump = invoice.bump,
        has_one = customer, has_one = mint)]
    pub invoice: Account<'info, Invoice>,
    pub customer: Signer<'info>,
    /// CHECK: Must match the merchant stored in the invoice and the token account authority.
    #[account(address = invoice.merchant)]
    pub merchant: UncheckedAccount<'info>,
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut, token::mint = mint, token::authority = customer, token::token_program = token_program)]
    pub customer_token: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, token::mint = mint, token::authority = merchant, token::token_program = token_program)]
    pub merchant_token: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct CancelInvoice<'info> {
    #[account(mut, seeds = [b"invoice", merchant.key().as_ref(), &invoice.id.to_le_bytes()], bump = invoice.bump,
        has_one = merchant)]
    pub invoice: Account<'info, Invoice>,
    pub merchant: Signer<'info>,
}

#[account]
#[derive(InitSpace)]
pub struct Invoice {
    pub id: u64,
    pub merchant: Pubkey,
    pub customer: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    #[max_len(64)]
    pub title: String,
    pub status: InvoiceStatus,
    pub paid_at: i64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, InitSpace)]
pub enum InvoiceStatus { Pending, Paid, Cancelled }

#[account]
#[derive(InitSpace)]
pub struct Counter {
    pub owner: Pubkey,
    pub value: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Profile {
    pub owner: Pubkey,
    #[max_len(64)]
    pub name: String,
    #[max_len(160)]
    pub bio: String,
    pub bump: u8,
}

#[error_code]
pub enum ProfileError {
    #[msg("Counter is full")]
    Overflow,
    #[msg("Name cannot be empty")]
    EmptyName,
    #[msg("Name is longer than 64 bytes")]
    NameTooLong,
    #[msg("Bio is longer than 160 bytes")]
    BioTooLong,
    #[msg("Amount must be greater than zero")]
    InvalidAmount,
    #[msg("Title must be 1 to 64 bytes")]
    InvalidTitle,
    #[msg("Merchant and customer must be different")]
    SameParty,
    #[msg("Invoice is already paid or cancelled")]
    InvoiceClosed,
}
