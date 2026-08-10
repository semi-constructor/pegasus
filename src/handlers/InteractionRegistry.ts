import {
  ButtonInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  ChannelSelectMenuInteraction,
  RoleSelectMenuInteraction,
} from 'discord.js';

type SelectMenuInteraction =
  | StringSelectMenuInteraction
  | ChannelSelectMenuInteraction
  | RoleSelectMenuInteraction;

export class InteractionRegistry {
  private buttonHandlers = new Map<string, (interaction: ButtonInteraction) => Promise<void>>();
  private modalHandlers = new Map<string, (interaction: ModalSubmitInteraction) => Promise<void>>();
  private selectHandlers = new Map<string, (interaction: SelectMenuInteraction) => Promise<void>>();

  public registerButton(prefix: string, handler: (interaction: ButtonInteraction) => Promise<void>) {
    this.buttonHandlers.set(prefix, handler);
  }

  public registerModal(prefix: string, handler: (interaction: ModalSubmitInteraction) => Promise<void>) {
    this.modalHandlers.set(prefix, handler);
  }

  public registerSelect(prefix: string, handler: (interaction: SelectMenuInteraction) => Promise<void>) {
    this.selectHandlers.set(prefix, handler);
  }

  public async handleButton(interaction: ButtonInteraction): Promise<boolean> {
    for (const [prefix, handler] of this.buttonHandlers.entries()) {
      if (interaction.customId.startsWith(prefix)) {
        await handler(interaction);
        return true;
      }
    }
    return false;
  }

  public async handleModal(interaction: ModalSubmitInteraction): Promise<boolean> {
    for (const [prefix, handler] of this.modalHandlers.entries()) {
      if (interaction.customId.startsWith(prefix)) {
        await handler(interaction);
        return true;
      }
    }
    return false;
  }

  public async handleSelectMenu(interaction: SelectMenuInteraction): Promise<boolean> {
    for (const [prefix, handler] of this.selectHandlers.entries()) {
      if (interaction.customId.startsWith(prefix)) {
        await handler(interaction);
        return true;
      }
    }
    return false;
  }
}

export const interactionRegistry = new InteractionRegistry();
