<script lang="ts">
    import Game from "$lib/game/game.svelte";

</script>

<div class="page">
    <Game />
</div>


<style lang="scss">
    :global(*) {
        box-sizing: border-box;
    }

    :global(body) {
        margin: 0; padding: 0;
    }
    
    .page {
        width: 100vw; height: 100vh;
    }


</style>