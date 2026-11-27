// Tracks Tab and Arrow key autocomplete suggestions for Explorer and Terminal
export class Autocomplete {
    constructor() {
        this.matches = [];
        this.index = -1;
        this.prefix = "";
        this.context = null;
        this.hasInlineSuggestion = false;
    }

    hasMatches() {
        return this.matches.length > 0;
    }

    reset() {
        this.matches = [];
        this.index = -1;
        this.prefix = "";
        this.context = null;
        this.hasInlineSuggestion = false;
    }

    setMatches(matches, { prefix = "", index = -1, context = null, inlineSuggested = false } = {}) {
        this.matches = matches;
        this.prefix = prefix;
        this.index = index;
        this.context = context;
        this.hasInlineSuggestion = inlineSuggested;
    }

    step(delta) {
        if (this.matches.length === 0) return null;

        if (this.hasInlineSuggestion) {
            this.hasInlineSuggestion = false;
            if (this.matches.length > 1) {
                this.index = (this.index + delta + this.matches.length) % this.matches.length;
            }
        } else if (this.index === -1) {
            this.index = delta > 0 ? 0 : this.matches.length - 1;
        } else {
            this.index = (this.index + delta + this.matches.length) % this.matches.length;
        }

        return {
            match: this.matches[this.index],
            index: this.index
        };
    }

    current() {
        if (this.index < 0 || this.index >= this.matches.length) return null;
        return this.matches[this.index];
    }
}
