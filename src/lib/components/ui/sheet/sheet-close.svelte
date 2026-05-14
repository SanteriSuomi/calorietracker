<script lang="ts">
	import { Dialog } from 'bits-ui';
																				import { cn, type WithElementRef } from '$lib/utils';
	
		
			
				
					
						
							
								
									
										
											
												
													
														
															
																
																	
																		
																			
																				let { class: className, ...restProps }: WithElementRef<Dialog.CloseProps> = $props();
</script>

<Dialog.Close
	{...restProps}
	class={cn('absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground', className)}
/>
